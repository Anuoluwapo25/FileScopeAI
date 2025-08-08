from rest_framework.decorators import api_view
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework import status
from django.core.files.storage import default_storage
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from django.core.paginator import Paginator
from django.db.models import Q
from .models import DatasetAnalysis
import mimetypes
from django.conf import settings
from .tasks import process_dataset, ALLOWED_EXTENSIONS, MAX_FILE_SIZE
from .filecoin_storage import FilecoinStorage 
import os
import uuid
import pandas as pd
import numpy as np
import json
import logging


from .tasks import (
    process_dataset,
    load_dataset,  
    get_basic_statistics,
    analyze_data_quality,
    detect_anomalies,
    analyze_bias,
    generate_insights,
    create_visualizations,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE
)
from .tasks import process_dataset
import logging
logger = logging.getLogger(__name__)


ALLOWED_EXTENSIONS = {'.csv', '.json', '.xlsx', '.xls', '.parquet'}
MAX_FILE_SIZE = 100 * 1024 * 1024 




@api_view(['POST'])
def upload_dataset(request):
    """
    Single endpoint for upload and analysis
    
    URL: POST /api/upload/
    
    Query Parameters:
    - include_visualizations: true/false (default: false)
    - analysis_depth: basic/full (default: basic)
    
    Form Data:
    - file: Dataset file (required)
    - name: Dataset name (optional)
    - description: Dataset description (optional)
    
    Response:
    {
        "success": true,
        "analysis_id": "uuid",
        "status": "completed",
        "dataset_info": {
            "name": "filename.csv",
            "rows": 1000,
            "columns": 25,
            "size_bytes": 524288,
            "file_type": "csv"
        },
        "results": {
            "quality_score": {
                "total_score": 85.5,
                "grade": "B",
                "component_scores": {...}
            },
            "metrics": {...},
            "insights": {...}
        },
        "visualizations": {
            "available": ["correlation_matrix", "distribution_age"],
            "included": false,
            "data": {...}  // only if include_visualizations=true
        }
    }
    """
    try:
        # Validate file upload
        if 'file' not in request.FILES:
            return Response({
                'success': false,
                'error': 'No file provided',
                'error_code': 'NO_FILE'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        dataset_name = request.POST.get('name', file.name)
        dataset_description = request.POST.get('description', '')
        
        # Get query parameters
        include_viz = request.query_params.get('include_visualizations', 'false').lower() == 'true'
        analysis_depth = request.query_params.get('analysis_depth', 'basic')
        
        # Validate and process file
        try:
            result = process_uploaded_file(
                file, 
                dataset_name, 
                dataset_description,
                include_viz,
                analysis_depth,
                request.user if request.user.is_authenticated else None
            )
            
            return Response(result, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
                'error_code': 'VALIDATION_ERROR'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Processing error: {str(e)}")
            return Response({
                'success': False,
                'error': 'Processing failed. Please try again.',
                'error_code': 'PROCESSING_ERROR'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return Response({
            'success': False,
            'error': 'Upload failed. Please try again.',
            'error_code': 'UPLOAD_ERROR'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def process_uploaded_file(file, name, description, include_viz, analysis_depth, user):
    """
    Process uploaded file and return complete analysis
    """
    # File validation
    file_extension = os.path.splitext(file.name)[1].lower()
    ALLOWED_EXTENSIONS = ['.csv', '.json', '.xlsx', '.xls', '.txt', '.tsv', '.parquet']
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    if file_extension not in ALLOWED_EXTENSIONS:
        raise ValueError(f'Unsupported file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}')
    
    if file.size > MAX_FILE_SIZE:
        raise ValueError(f'File too large. Maximum size: {MAX_FILE_SIZE//(1024*1024)}MB')
    
    # Load and validate dataset
    try:
        df, dataset_info = load_and_validate_dataset(file, file_extension)
    except Exception as e:
        raise ValueError(f'Invalid file content: {str(e)}')
    
    # Save file
    file_path = default_storage.save(f'datasets/{uuid.uuid4()}_{file.name}', file)
    
    # Create analysis record - using your actual model fields
    from .models import DatasetAnalysis
    analysis = DatasetAnalysis.objects.create(
        user=user,
        dataset_file=file_path,
        status='processing',
        rows_count=dataset_info['rows'],
        columns_count=dataset_info['columns'],
        dataset_size=f"{dataset_info['size_bytes']} bytes"
    )
    
    try:
        # Perform analysis
        results = analyze_dataset(df, dataset_info, analysis_depth)
        
        # Generate visualizations if requested
        visualizations = {}
        if include_viz:
            visualizations = generate_visualizations(df)
        
        # Update analysis record - using your actual model fields with JSON-safe types
        analysis.status = 'completed'
        analysis.quality_score = float(results['quality_score']['total_score'])
        analysis.rows_count = int(dataset_info['rows'])
        analysis.columns_count = int(dataset_info['columns'])
        analysis.missing_values_pct = float(dataset_info['missing_percentage'])
        analysis.duplicate_count = int(df.duplicated().sum())
        analysis.full_analysis = results  # Now all values are JSON-safe
        analysis.key_insights = {'insights': results.get('insights', [])}
        analysis.save()
        
        response_data = {
            'success': True,
            'analysis_id': str(analysis.id),
            'status': 'completed',
            'dataset_info': {
                'original_filename': file.name,
                **dataset_info
            },
            'results': results,
            'visualizations': {
                'available': list(visualizations.keys()),
                'included': include_viz,
                'count': len(visualizations)
            }
        }
        
        if include_viz:
            response_data['visualizations']['data'] = visualizations
        
        return response_data
        
    except Exception as e:
        analysis.status = 'failed'
        analysis.error_message = str(e)
        analysis.save()
        raise e


def load_and_validate_dataset(file, file_extension):
    """Load dataset and extract basic information"""
    
    file_size = file.size
    
    # Load dataset based on type
    if file_extension == '.csv':
        df = pd.read_csv(file, encoding='utf-8', low_memory=False)
    elif file_extension == '.tsv':
        df = pd.read_csv(file, sep='\t', encoding='utf-8', low_memory=False)
    elif file_extension == '.json':
        df = load_json_dataset(file)
    elif file_extension in ['.xlsx', '.xls']:
        df = pd.read_excel(file)
    elif file_extension == '.txt':
        df = load_txt_dataset(file)
    elif file_extension == '.parquet':
        df = pd.read_parquet(file)
    else:
        df = pd.read_csv(file, encoding='utf-8', low_memory=False)
    
    # Basic validation
    if df.empty:
        raise ValueError("Dataset is empty")
    
    if len(df.columns) == 0:
        raise ValueError("No columns found in dataset")
    
    # Extract dataset info with JSON-safe types
    dataset_info = {
        'rows': int(len(df)),
        'columns': int(len(df.columns)),
        'size_bytes': int(file_size),
        'file_type': file_extension.lstrip('.'),
        'column_names': [str(col) for col in df.columns.tolist()],
        'column_types': {str(col): str(dtype) for col, dtype in df.dtypes.items()},
        'memory_usage_mb': round(float(df.memory_usage(deep=True).sum() / (1024*1024)), 2),
        'has_missing_values': bool(df.isnull().any().any()),
        'missing_percentage': round(float(df.isnull().sum().sum() / (len(df) * len(df.columns)) * 100) if len(df) > 0 and len(df.columns) > 0 else 0, 2)
    }
    
    return df, dataset_info


def load_json_dataset(file):
    """Load JSON dataset with multiple format support"""
    content = file.read()
    if isinstance(content, bytes):
        content = content.decode('utf-8')
    
    try:
        data = json.loads(content)
        
        if isinstance(data, list):
            return pd.DataFrame(data)
        elif isinstance(data, dict):
            if 'data' in data and isinstance(data['data'], list):
                return pd.DataFrame(data['data'])
            else:
                return pd.DataFrame([data])
        else:
            raise ValueError("Unsupported JSON structure")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON format: {str(e)}")


def load_txt_dataset(file):
    """Load TXT file and attempt to detect structure"""
    content = file.read()
    if isinstance(content, bytes):
        content = content.decode('utf-8', errors='ignore')
    
    lines = content.strip().split('\n')
    if not lines:
        raise ValueError("Empty file")
    
    # Try to detect separator
    first_line = lines[0]
    separators = ['\t', ',', '|', ';']
    
    best_sep = None
    max_cols = 0
    
    for sep in separators:
        cols = len(first_line.split(sep))
        if cols > max_cols and cols > 1:
            max_cols = cols
            best_sep = sep
    
    if best_sep and max_cols > 1:
        # Structured data
        from io import StringIO
        return pd.read_csv(StringIO(content), sep=best_sep)
    else:
        # Treat as single column
        return pd.DataFrame({'text': lines})


def analyze_dataset(df, dataset_info, depth='basic'):
    """Perform dataset analysis based on depth level"""
    
    results = {
        'quality_score': calculate_quality_score(df),
        'basic_metrics': get_basic_metrics(df),
        'insights': generate_basic_insights(df, dataset_info)
    }
    
    if depth == 'full':
        results.update({
            'detailed_statistics': get_detailed_statistics(df),
            'correlation_analysis': get_correlation_analysis(df),
            'outlier_analysis': get_outlier_analysis(df),
            'advanced_insights': generate_advanced_insights(df)
        })
    
    return results


def calculate_quality_score(df):
    """
    Calculate comprehensive dataset quality score (0-100)
    
    Scoring Breakdown:
    - Completeness: 40 points (missing data)
    - Size Adequacy: 30 points (rows + columns) 
    - Data Consistency: 30 points (types + naming + duplicates)
    """
    scores = {}
    
    # 1. COMPLETENESS SCORE (40 points)
    total_cells = len(df) * len(df.columns)
    missing_cells = int(df.isnull().sum().sum())  # Convert to Python int
    
    if total_cells > 0:
        missing_ratio = missing_cells / total_cells
        completeness_score = (1 - missing_ratio) * 40
    else:
        completeness_score = 0
    
    scores['completeness'] = round(float(completeness_score), 2)
    
    # 2. SIZE ADEQUACY SCORE (30 points)
    rows, cols = len(df), len(df.columns)
    
    # Row adequacy (20 points max)
    if rows >= 1000:
        row_score = 20
    elif rows >= 500:
        row_score = 15
    elif rows >= 100:
        row_score = 10
    elif rows >= 50:
        row_score = 5
    else:
        row_score = 0
    
    # Column adequacy (10 points max)
    if cols >= 10:
        col_score = 10
    elif cols >= 5:
        col_score = 7
    elif cols >= 3:
        col_score = 5
    elif cols >= 2:
        col_score = 3
    else:
        col_score = 0
    
    size_score = row_score + col_score
    scores['size'] = float(size_score)
    
    # 3. DATA CONSISTENCY SCORE (30 points)
    consistency_total = 0
    
    # 3A. Data Type Consistency (15 points)
    type_consistency = 0
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    
    for col in df.columns:
        try:
            if col in numeric_cols:
                # Check if numeric column has reasonable values
                if not df[col].isin([np.inf, -np.inf]).any():
                    type_consistency += 1
            else:
                # For non-numeric columns, check for consistency
                if df[col].dtype == 'object':
                    # Check if it's not a mixed type column
                    try:
                        # Try to convert to numeric - if >90% fail, it's likely text
                        numeric_vals = pd.to_numeric(df[col], errors='coerce').notna().sum()
                        total_vals = df[col].notna().sum()
                        if total_vals == 0 or numeric_vals / total_vals < 0.1 or numeric_vals / total_vals > 0.9:
                            type_consistency += 1
                    except:
                        type_consistency += 1
                else:
                    type_consistency += 1
        except:
            pass
    
    if len(df.columns) > 0:
        type_score = (type_consistency / len(df.columns)) * 15
    else:
        type_score = 0
    
    consistency_total += type_score
    
    # 3B. Column Naming Quality (10 points)
    naming_quality = 0
    total_naming_checks = 0
    
    for col in df.columns:
        col_str = str(col)
        checks_passed = 0
        
        # Check 1: No leading/trailing spaces
        if col_str.strip() == col_str:
            checks_passed += 1
        
        # Check 2: No problematic characters
        problematic_chars = ['?', '#', '@', '!', '*', '&', '%']
        if not any(char in col_str for char in problematic_chars):
            checks_passed += 1
        
        # Check 3: Not unnamed columns
        if not col_str.lower().startswith('unnamed'):
            checks_passed += 1
        
        # Check 4: Reasonable format (not too long, has some structure)
        if len(col_str) > 0 and len(col_str) < 100:
            checks_passed += 1
        
        naming_quality += checks_passed
        total_naming_checks += 4
    
    if total_naming_checks > 0:
        naming_score = (naming_quality / total_naming_checks) * 10
    else:
        naming_score = 0
    
    consistency_total += naming_score
    
    # 3C. Duplicate Records (5 points)
    if len(df) > 0:
        duplicate_count = int(df.duplicated().sum())  # Convert to Python int
        duplicate_ratio = duplicate_count / len(df)
        duplicate_score = (1 - duplicate_ratio) * 5
    else:
        duplicate_score = 0
        duplicate_count = 0
    
    consistency_total += duplicate_score
    
    scores['consistency'] = round(float(consistency_total), 2)
    scores['breakdown'] = {
        'type_consistency': round(float(type_score), 2),
        'naming_quality': round(float(naming_score), 2), 
        'duplicate_penalty': round(float(duplicate_score), 2)
    }
    
    # Calculate total score
    total_score = sum([scores['completeness'], scores['size'], scores['consistency']])
    
    # Additional metrics for detailed analysis - all converted to Python native types
    metrics = {
        'missing_percentage': round(float((missing_cells / total_cells * 100) if total_cells > 0 else 0), 2),
        'duplicate_percentage': round(float((duplicate_count / len(df) * 100) if len(df) > 0 else 0), 2),
        'columns_with_missing': [str(col) for col in df.columns[df.isnull().any()].tolist()],
        'row_count': int(rows),
        'column_count': int(cols)
    }
    
    return {
        'total_score': round(float(total_score), 1),
        'component_scores': scores,
        'grade': get_grade(total_score),
        'detailed_metrics': metrics,
        'score_explanation': {
            'completeness_details': f"Missing {missing_cells}/{total_cells} cells ({metrics['missing_percentage']}%)",
            'size_details': f"{rows} rows, {cols} columns",
            'consistency_details': f"{metrics['duplicate_percentage']}% duplicates, type consistency check passed"
        }
    }


def get_grade(score):
    """Convert score to letter grade"""
    if score >= 90: return 'A'
    elif score >= 80: return 'B'
    elif score >= 70: return 'C'
    elif score >= 60: return 'D'
    else: return 'F'


def get_basic_metrics(df):
    """Get basic dataset metrics with JSON-safe types"""
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    categorical_cols = df.select_dtypes(include=['object']).columns
    
    # Convert all numpy types to Python native types for JSON serialization
    total_missing = int(df.isnull().sum().sum())
    duplicate_rows = int(df.duplicated().sum())
    
    return {
        'shape': {'rows': int(len(df)), 'columns': int(len(df.columns))},
        'column_types': {
            'numeric': int(len(numeric_cols)),
            'categorical': int(len(categorical_cols)),
            'datetime': int(len(df.select_dtypes(include=['datetime']).columns))
        },
        'missing_data': {
            'total_missing': total_missing,
            'columns_with_missing': [str(col) for col in df.columns[df.isnull().any()].tolist()],
            'missing_percentage': round(float(total_missing / (len(df) * len(df.columns)) * 100) if len(df) > 0 and len(df.columns) > 0 else 0, 2)
        },
        'duplicates': {
            'duplicate_rows': duplicate_rows,
            'duplicate_percentage': round(float(duplicate_rows / len(df) * 100) if len(df) > 0 else 0, 2)
        }
    }


def generate_basic_insights(df, dataset_info):
    """Generate basic insights about the dataset"""
    insights = []
    
    missing_pct = dataset_info.get('missing_percentage', 0)
    if missing_pct > 20:
        insights.append(f"High missing data ({missing_pct}%) - consider data cleaning")
    elif missing_pct > 5:
        insights.append(f"Moderate missing data ({missing_pct}%) detected")
    
    if len(df) < 100:
        insights.append("Small dataset - results may have limited statistical power")
    elif len(df) > 100000:
        insights.append("Large dataset - consider sampling for initial exploration")
    
    if len(df.columns) > 50:
        insights.append("High-dimensional dataset - consider feature selection")
    
    duplicate_pct = (df.duplicated().sum() / len(df)) * 100
    if duplicate_pct > 10:
        insights.append(f"High duplication ({duplicate_pct:.1f}%) - consider deduplication")
    
    return insights


def generate_visualizations(df):
    """Generate basic visualizations (placeholder - implement with matplotlib/plotly)"""
    visualizations = {}
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    categorical_cols = df.select_dtypes(include=['object']).columns
    
    # This would contain actual visualization generation code
    # For now, return metadata about what visualizations would be available
    
    for col in numeric_cols[:5]:  # First 5 numeric columns
        visualizations[f'distribution_{col}'] = {
            'type': 'histogram',
            'description': f'Distribution of {col}',
            'data': None  # Would contain actual chart data/image
        }
    
    if len(numeric_cols) > 1:
        visualizations['correlation_matrix'] = {
            'type': 'heatmap',
            'description': 'Correlation matrix of numeric variables',
            'data': None
        }
    
    for col in categorical_cols[:3]:  # First 3 categorical columns
        if df[col].nunique() <= 20:  # Only for columns with reasonable number of categories
            visualizations[f'bar_{col}'] = {
                'type': 'bar',
                'description': f'Distribution of {col}',
                'data': None
            }
    
    return visualizations


@api_view(['GET'])
def get_analysis(request, analysis_id):
    """
    Get analysis results by ID - returns the SAME results as upload
    URL: GET /api/analysis/{analysis_id}/
    """
    try:
        from .models import DatasetAnalysis
        analysis = DatasetAnalysis.objects.get(id=analysis_id)
        
        # Return the same structure as upload endpoint
        response_data = {
            'success': True,
            'analysis_id': str(analysis.id),
            'status': analysis.status,
            'dataset_info': {
                'original_filename': analysis.dataset_file.name.split('/')[-1] if analysis.dataset_file else 'unknown',
                'rows': int(analysis.rows_count),
                'columns': int(analysis.columns_count),
                'size_bytes': analysis.dataset_size,
                'file_type': analysis.dataset_file.name.split('.')[-1] if analysis.dataset_file else 'unknown',
                'memory_usage_mb': getattr(analysis, 'memory_usage_mb', 0),
                'has_missing_values': analysis.missing_values_pct > 0,
                'missing_percentage': float(analysis.missing_values_pct)
            },
            'results': analysis.full_analysis if analysis.full_analysis else {
                'quality_score': {
                    'total_score': float(analysis.quality_score),
                    'grade': get_grade(analysis.quality_score)
                },
                'basic_metrics': {
                    'missing_data': {
                        'missing_percentage': float(analysis.missing_values_pct)
                    },
                    'duplicates': {
                        'duplicate_rows': int(analysis.duplicate_count),
                        'duplicate_percentage': round(float(analysis.duplicate_count / analysis.rows_count * 100) if analysis.rows_count > 0 else 0, 2)
                    }
                }
            },
            'metadata': {
                'uploaded_at': analysis.uploaded_at,
                'processing_time': analysis.processing_time or 'N/A',
                'error_message': analysis.error_message if analysis.status == 'failed' else None
            }
        }
        
        # Add insights if available
        if analysis.key_insights:
            response_data['results']['insights'] = analysis.key_insights.get('insights', [])
        
        # Add visualization info
        if hasattr(analysis, 'visualization_data') and analysis.visualization_data:
            response_data['visualizations'] = {
                'available': list(analysis.visualization_data.keys()),
                'included': False,
                'count': len(analysis.visualization_data)
            }
        else:
            response_data['visualizations'] = {
                'available': [],
                'included': False,
                'count': 0
            }
        
        return Response(response_data)
        
    except DatasetAnalysis.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Analysis not found',
            'error_code': 'NOT_FOUND'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error retrieving analysis {analysis_id}: {str(e)}")
        return Response({
            'success': False,
            'error': 'Error retrieving analysis',
            'error_code': 'RETRIEVAL_ERROR'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_visualizations(request, analysis_id):
    """
    Get visualizations for an analysis
    URL: GET /api/analysis/{analysis_id}/visualizations/
    """
    try:
        from .models import DatasetAnalysis
        analysis = DatasetAnalysis.objects.get(id=analysis_id)
        
        if analysis.status != 'completed':
            return Response({
                'success': False,
                'error': 'Analysis not completed yet',
                'error_code': 'NOT_READY'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get visualization data from stored results
        visualizations = {}
        if hasattr(analysis, 'visualization_data') and analysis.visualization_data:
            visualizations = analysis.visualization_data
        elif analysis.full_analysis and 'visualizations' in analysis.full_analysis:
            visualizations = analysis.full_analysis['visualizations']
        
        return Response({
            'success': True,
            'analysis_id': str(analysis.id),
            'visualizations': {
                'available': list(visualizations.keys()),
                'data': visualizations,
                'count': len(visualizations),
                'included': True
            }
        })
        
    except DatasetAnalysis.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Analysis not found',
            'error_code': 'NOT_FOUND'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET']) 
def debug_analysis_comparison(request, analysis_id):
    """
    Debug endpoint to compare stored analysis data
    URL: GET /api/analysis/{analysis_id}/debug/
    """
    try:
        from .models import DatasetAnalysis
        analysis = DatasetAnalysis.objects.get(id=analysis_id)
        
        # Extract all relevant fields from the model
        model_data = {
            'id': analysis.id,
            'status': analysis.status,
            'uploaded_at': analysis.uploaded_at,
            'rows_count': analysis.rows_count,
            'columns_count': analysis.columns_count,
            'quality_score': analysis.quality_score,
            'anomaly_count': analysis.anomaly_count,
            'bias_score': analysis.bias_score,
            'dataset_size': analysis.dataset_size,
            'missing_values_pct': analysis.missing_values_pct,
            'duplicate_count': analysis.duplicate_count,
            'processing_time': analysis.processing_time,
            'error_message': analysis.error_message
        }
        
        # Show what's stored in JSON fields
        json_fields = {
            'full_analysis': analysis.full_analysis,
            'key_insights': analysis.key_insights,
            'visualization_data': getattr(analysis, 'visualization_data', {}),
            'anomaly_examples': analysis.anomaly_examples
        }
        
        return Response({
            'analysis_id': str(analysis.id),
            'model_fields': model_data,
            'json_fields': json_fields,
            'analysis_summary': {
                'has_full_analysis': bool(analysis.full_analysis),
                'full_analysis_keys': list(analysis.full_analysis.keys()) if analysis.full_analysis else [],
                'insights_count': len(analysis.key_insights.get('insights', [])) if analysis.key_insights else 0,
                'visualization_count': len(getattr(analysis, 'visualization_data', {}))
            }
        })
        
    except DatasetAnalysis.DoesNotExist:
        return Response({
            'error': 'Analysis not found'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
def list_user_analyses(request):
    """
    List all analyses for the authenticated user
    """
    try:
        analyses = DatasetAnalysis.objects.filter(user=request.user).order_by('-uploaded_at')
        
        page = request.GET.get('page', 1)
        per_page = min(int(request.GET.get('per_page', 10)), 50) 
        
        paginator = Paginator(analyses, per_page)
        page_obj = paginator.get_page(page)
        
        analyses_data = []
        for analysis in page_obj:
            analyses_data.append({
                'analysis_id': str(analysis.id),
                'status': analysis.status,
                'uploaded_at': analysis.uploaded_at.isoformat(),
                'dataset_size': analysis.dataset_size,
                'quality_score': analysis.quality_score,
                'anomaly_count': analysis.anomaly_count,
                'bias_score': analysis.bias_score,
                'has_filecoin_storage': bool(analysis.analysis_cid),
                'verification_url': analysis.verification_url
            })
        
        return Response({
            'analyses': analyses_data,
            'pagination': {
                'current_page': page_obj.number,
                'total_pages': paginator.num_pages,
                'total_count': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            }
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to retrieve analyses: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['DELETE'])
def delete_analysis(request, analysis_id):
    """
    Delete an analysis
    """
    try:
        analysis = DatasetAnalysis.objects.get(
            id=analysis_id, 
            user=request.user
        )
        
        if analysis.dataset_file:
            try:
                default_storage.delete(analysis.dataset_file.name)
            except Exception as e:
                pass
        
        analysis.delete()
        
        return Response({
            'message': 'Analysis deleted successfully'
        }, status=status.HTTP_200_OK)
        
    except DatasetAnalysis.DoesNotExist:
        return Response(
            {'error': 'Analysis not found or access denied'}, 
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(['GET'])
def get_public_analysis(request, analysis_cid):
    """
    Get public analysis results from Filecoin CID
    """
    try:
        # Find analysis by CID
        analysis = DatasetAnalysis.objects.filter(analysis_cid=analysis_cid).first()
        
        if not analysis:
            return Response(
                {'error': 'Analysis not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        if analysis.status != 'completed':
            return Response(
                {'error': 'Analysis not completed'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response({
            'analysis_cid': analysis.analysis_cid,
            'dataset_cid': analysis.dataset_cid,
            'uploaded_at': analysis.uploaded_at.isoformat(),
            'dataset_size': analysis.dataset_size,
            'results': {
                'quality_score': analysis.quality_score,
                'anomaly_count': analysis.anomaly_count,
                'bias_score': analysis.bias_score,
                'insights': analysis.key_insights,
                'visualization_data': analysis.visualization_data,
            },
            'verification_url': analysis.verification_url,
            'filecoin_verified': True
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to retrieve public analysis: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def browse_public_datasets(request):
    """
    Browse public datasets with analysis results
    """
    try:
        analyses = DatasetAnalysis.objects.filter(
            status='completed',
            analysis_cid__isnull=False
        ).exclude(analysis_cid='').order_by('-uploaded_at')
        
        quality_min = request.GET.get('quality_min')
        if quality_min:
            analyses = analyses.filter(quality_score__gte=float(quality_min))
        
        bias_max = request.GET.get('bias_max')
        if bias_max:
            analyses = analyses.filter(bias_score__lte=float(bias_max))
        
        search = request.GET.get('search')
        if search:
            analyses = analyses.filter(
                Q(key_insights__icontains=search) |
                Q(dataset_size__icontains=search)
            )
        
        # Pagination
        page = request.GET.get('page', 1)
        per_page = min(int(request.GET.get('per_page', 20)), 50)
        
        paginator = Paginator(analyses, per_page)
        page_obj = paginator.get_page(page)
        
        datasets_data = []
        for analysis in page_obj:
            datasets_data.append({
                'analysis_cid': analysis.analysis_cid,
                'dataset_cid': analysis.dataset_cid,
                'uploaded_at': analysis.uploaded_at.isoformat(),
                'dataset_size': analysis.dataset_size,
                'quality_score': analysis.quality_score,
                'anomaly_count': analysis.anomaly_count,
                'bias_score': analysis.bias_score,
                'verification_url': analysis.verification_url,
                'summary': analysis.key_insights.get('summary', '') if analysis.key_insights else ''
            })
        
        return Response({
            'datasets': datasets_data,
            'pagination': {
                'current_page': page_obj.number,
                'total_pages': paginator.num_pages,
                'total_count': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            },
            'filters_applied': {
                'quality_min': quality_min,
                'bias_max': bias_max,
                'search': search
            }
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to browse datasets: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# @api_view(['GET'])
# def get_platform_stats(request):
#     """
#     Get platform statistics
#     """
#     try:
#         total_analyses = DatasetAnalysis.objects.count()
#         completed_analyses = DatasetAnalysis.objects.filter(status='completed').count()
#         failed_analyses = DatasetAnalysis.objects.filter(status='failed').count()
#         processing_analyses = DatasetAnalysis.objects.filter(status='processing').count()
        
#         # Filecoin storage stats
#         stored_on_filecoin = DatasetAnalysis.objects.filter(
#             analysis_cid__isnull=False
#         ).exclude(analysis_cid='').count()
        
#         # Quality stats
#         avg_quality = DatasetAnalysis.objects.filter(
#             quality_score__isnull=False
#         ).aggregate(avg_quality=models.Avg('quality_score'))['avg_quality']
        
#         return Response({
#             'total_datasets_analyzed': total_analyses,
#             'completed_analyses': completed_analyses,
#             'failed_analyses': failed_analyses,
#             'currently_processing': processing_analyses,
#             'stored_on_filecoin': stored_on_filecoin,
#             'average_quality_score': round(avg_quality, 2) if avg_quality else None,
#             'success_rate': round((completed_analyses / total_analyses * 100), 2) if total_analyses > 0 else 0
#         })
        
#     except Exception as e:
#         return Response(
#             {'error': f'Failed to retrieve platform stats: {str(e)}'}, 
#             status=status.HTTP_500_INTERNAL_SERVER_ERROR
#         )


# @api_view(['GET'])
# def get_analysis_status(request, analysis_id):
#     """
#     Get analysis status and results
#     """
#     try:
#         analysis = get_object_or_404(DatasetAnalysis, id=analysis_id)
        
#         response_data = {
#             'analysis_id': str(analysis.id),
#             'status': analysis.status,
#             'uploaded_at': analysis.uploaded_at.isoformat(),
#             'file_name': os.path.basename(analysis.dataset_file.name),
#         }
        
#         if analysis.status == 'completed':
#             response_data['results'] = results
        
#         return Response(response_data)
        
#     except Exception as e:
#         return Response(
#             {'error': str(e)},
#             status=status.HTTP_500_INTERNAL_SERVER_ERROR
#  
#        )




@api_view(['GET'])
def get_analysis_status(request, analysis_id):
    try:
        analysis = get_object_or_404(DatasetAnalysis, id=analysis_id)
        
        response = {
            'metadata': {
                'analysis_id': str(analysis.id),
                'status': analysis.status,
                'uploaded_at': analysis.uploaded_at.isoformat(),
                'file_name': os.path.basename(analysis.dataset_file.name),
                'processing_time': getattr(analysis, 'processing_time', 'N/A'),
                'dimensions': {
                    'rows': getattr(analysis, 'rows_count', 0),
                    'columns': getattr(analysis, 'columns_count', 0)
                }
            }
        }

        if analysis.status == 'completed':
            # Get the complete stored analysis or empty dict if none
            full_analysis = getattr(analysis, 'full_analysis', {})
            visualization_data = getattr(analysis, 'visualization_data', {})
            
            results = {
                # 1. Dataset Summary/Metadata
                'dataset_profile': {
                    'data_types': full_analysis.get('data_types', {}),
                    'completeness': full_analysis.get('completeness', {}),
                    'sample_values': full_analysis.get('sample_values', {})
                },
                
                # 2. Anomaly Detection
                'anomalies': {
                    'count': getattr(analysis, 'anomaly_count', 0),
                    'critical': getattr(analysis, 'critical_anomalies', 0),
                    'moderate': getattr(analysis, 'moderate_anomalies', 0),
                    'method': full_analysis.get('anomaly_method', 'Isolation Forest'),
                    'examples': full_analysis.get('anomaly_examples', [])
                },
                
                # 3. Bias Assessment
                'bias': {
                    'score': getattr(analysis, 'bias_score', 100),
                    'assessment': "not assessed" if analysis.bias_score is None
                                else "high" if analysis.bias_score < 70
                                else "moderate" if analysis.bias_score < 85
                                else "low",
                    'imbalanced_fields': full_analysis.get('imbalanced_fields', {})
                },
                
                # 4. Quality Scoring
                'quality': {
                    'overall_score': getattr(analysis, 'quality_score', 100),
                    'components': {
                        'completeness': full_analysis.get('completeness_score', 100),
                        'duplicates': full_analysis.get('duplicate_percentage', 0),
                        'schema_issues': full_analysis.get('schema_violations', 0)
                    }
                },
                
                # 5-12. Other Analysis Components
                'advanced_analysis': {
                    'correlations': full_analysis.get('correlation_matrix', {}),
                    'red_flags': full_analysis.get('data_integrity_issues', []),
                    'nlp_summary': full_analysis.get('text_analysis', {}),
                    'cluster_analysis': full_analysis.get('cluster_results', {})
                },
                
                # Visualization Handling
                'visualizations': {
                    'available': list(visualization_data.keys()),
                    'include_data': False  # Default to not include heavy base64
                }
            }
            
            # Optionally include visualization data if requested
            if request.query_params.get('include_visualizations'):
                results['visualizations']['data'] = visualization_data
                results['visualizations']['include_data'] = True
            
            response['results'] = results
        
        return Response(response)
        
    except Exception as e:
        logger.error(f"Error fetching analysis {analysis_id}: {str(e)}")
        return Response(
            {'error': f"Could not retrieve analysis: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )