import matplotlib
matplotlib.use('Agg')
import pandas as pd
import numpy as np
import json
import os
import io
import base64
import logging
from django.core.files.storage import default_storage
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
import matplotlib.pyplot as plt
import seaborn as sns
from .models import DatasetAnalysis

logger = logging.getLogger(__name__)
plt.style.use('seaborn-v0_8')
sns.set_theme(style="whitegrid")
plt.rcParams['figure.figsize'] = (10, 6)
plt.rcParams['axes.labelsize'] = 12

ALLOWED_EXTENSIONS = {'.csv', '.json', '.xlsx', '.xls', '.parquet'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

def load_dataset(file_path):
    """Load dataset from file path"""
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.csv':
            return pd.read_csv(file_path)
        elif ext == '.json':
            return pd.read_json(file_path)
        elif ext in ['.xlsx', '.xls']:
            return pd.read_excel(file_path)
        elif ext == '.parquet':
            return pd.read_parquet(file_path)
        return pd.read_csv(file_path)  # Try CSV as default
    except Exception as e:
        logger.error(f"Error loading dataset: {str(e)}")
        return None

def get_basic_statistics(df):
    """Generate basic dataset statistics"""
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns
    
    stats = {
        'total_rows': len(df),
        'total_columns': len(df.columns),
        'numeric_columns': len(numeric_cols),
        'categorical_columns': len(categorical_cols),
        'missing_values': df.isnull().sum().sum(),
        'duplicate_rows': df.duplicated().sum(),
        'column_info': {}
    }
    
    for col in df.columns:
        col_info = {
            'type': str(df[col].dtype),
            'null_count': df[col].isnull().sum(),
            'unique_values': df[col].nunique(),
        }
        if col in numeric_cols:
            col_info.update({
                'mean': df[col].mean(),
                'std': df[col].std(),
                'min': df[col].min(),
                'max': df[col].max()
            })
        elif col in categorical_cols:
            col_info.update({
                'most_common': df[col].mode()[0] if not df[col].empty else None,
                'value_counts': df[col].value_counts().head(5).to_dict()
            })
        stats['column_info'][col] = col_info
    
    return stats

def analyze_data_quality(df):
    """Analyze dataset quality metrics"""
    quality_issues = []
    scores = {'missing_data_score': 100, 'duplicate_score': 100, 'consistency_score': 100}
    
    # Missing data analysis
    missing_pct = (df.isnull().sum() / len(df)) * 100
    scores['missing_data_score'] = max(0, 100 - missing_pct.mean())
    if missing_pct.mean() > 20:
        quality_issues.append(f"High missing data: {missing_pct.mean():.1f}%")
    
    # Duplicate analysis
    duplicate_pct = (df.duplicated().sum() / len(df)) * 100
    scores['duplicate_score'] = max(0, 100 - duplicate_pct)
    if duplicate_pct > 5:
        quality_issues.append(f"High duplicate rate: {duplicate_pct:.1f}%")
    
    # Data consistency
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if not df[col].isnull().all():
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            outliers = ((df[col] < (Q1 - 3*IQR)) | (df[col] > (Q3 + 3*IQR))).sum()
            if outliers > 0:
                scores['consistency_score'] -= 10
    
    return {
        'overall_score': round((scores['missing_data_score'] + scores['duplicate_score'] + scores['consistency_score']) / 3, 2),
        'component_scores': scores,
        'quality_issues': quality_issues
    }

# def detect_anomalies(df):
#     """Detect anomalies in numeric columns"""
#     numeric_cols = df.select_dtypes(include=[np.number]).columns
#     if len(numeric_cols) == 0:
#         return {'total_anomalies': 0, 'anomaly_details': {}}
    
#     # Isolation Forest
#     clf = IsolationForest(contamination=0.1, random_state=42)
#     anomalies = clf.fit_predict(df[numeric_cols])
#     anomaly_indices = np.where(anomalies == -1)[0]
    
#     return {
#         'total_anomalies': len(anomaly_indices),
#         'anomaly_details': {
#             'isolation_forest': {
#                 'count': len(anomaly_indices),
#                 'indices': anomaly_indices.tolist()[:50]  # Limit to first 50
#             }
#         }
#     }

# def detect_anomalies(df):
#     """Enhanced anomaly detection with severity classification"""
#     numeric_cols = df.select_dtypes(include=[np.number]).columns
#     if len(numeric_cols) == 0:
#         return {
#             'total_anomalies': 0,
#             'critical': 0,
#             'moderate': 0,
#             'examples': []
#         }
    
#     # Isolation Forest
#     clf = IsolationForest(contamination=0.1, random_state=42)
#     anomalies = clf.fit_predict(df[numeric_cols])
#     anomaly_indices = np.where(anomalies == -1)[0]
    
#     # Calculate severity (example logic)
#     critical = []
#     moderate = []
#     for idx in anomaly_indices:
#         row = df.iloc[idx][numeric_cols]
#         severity = "critical" if (row - df[numeric_cols].mean()).abs().max() > 3*df[numeric_cols].std().max() else "moderate"
#         if severity == "critical":
#             critical.append(idx)
#         else:
#             moderate.append(idx)
    
#     return {
#         'total_anomalies': len(anomaly_indices),
#         'critical': len(critical),
#         'moderate': len(moderate),
#         'examples': {
#             'critical': critical[:3], 
#             'moderate': moderate[:3]
#         }
#     }
def detect_anomalies(df):
    """Enhanced anomaly detection with severity classification"""
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) == 0:
        return {
            'total_anomalies': 0,
            'critical': 0,
            'moderate': 0,
            'examples': []
        }
    
    clf = IsolationForest(contamination=0.1, random_state=42)
    anomalies = clf.fit_predict(df[numeric_cols])
    anomaly_indices = np.where(anomalies == -1)[0]
    
    critical = []
    moderate = []
    for idx in anomaly_indices:
        row = df.iloc[idx][numeric_cols]
        severity = "critical" if (row - df[numeric_cols].mean()).abs().max() > 3*df[numeric_cols].std().max() else "moderate"
        if severity == "critical":
            critical.append(idx)
        else:
            moderate.append(idx)
    
    return {
        'total_anomalies': len(anomaly_indices),
        'critical': len(critical),
        'moderate': len(moderate),
        'examples': {
            'critical': critical[:3],  # First 3 examples
            'moderate': moderate[:3]
        }
    }
def analyze_bias(df):
    """Analyze potential dataset biases"""
    # Simplified bias analysis
    bias_score = 100
    issues = []
    
    # Check demographic column balance
    demo_cols = [col for col in df.columns if any(kw in col.lower() for kw in ['gender', 'race', 'age'])]
    for col in demo_cols:
        value_counts = df[col].value_counts(normalize=True)
        if len(value_counts) > 0 and (value_counts.max() - value_counts.min()) > 0.5:
            bias_score -= 15
            issues.append(f"Potential bias in {col}")
    
    return {'overall_bias_score': max(0, bias_score), 'bias_issues': issues}

def generate_insights(df):
    """Generate key insights about the dataset"""
    insights = {
        'summary': f"Dataset contains {len(df)} records with {len(df.columns)} features",
        'key_findings': [],
        'recommendations': []
    }
    
    # Add basic findings
    if df.isnull().sum().sum() > 0:
        insights['key_findings'].append("Dataset contains missing values")
        insights['recommendations'].append("Consider imputation or removal of missing values")
    
    return insights

# def create_visualizations(df):
#     """Generate visualization data"""
#     visualizations = {}
    
#     # Missing data heatmap
#     if df.isnull().sum().sum() > 0:
#         fig, ax = plt.subplots()
#         sns.heatmap(df.isnull(), cbar=False, ax=ax)
#         visualizations['missing_data'] = plot_to_base64(fig)
#         plt.close(fig)
    
#     # Numeric distributions (first 3 columns)
#     numeric_cols = df.select_dtypes(include=[np.number]).columns[:3]
#     for col in numeric_cols:
#         fig, ax = plt.subplots()
#         df[col].hist(ax=ax)
#         visualizations[f'distribution_{col}'] = plot_to_base64(fig)
#         plt.close(fig)
    
#     return visualizations

def create_visualizations(df):
    """Generate visualization data using non-interactive backend"""
    visualizations = {}
    
    # Missing data heatmap
    if df.isnull().sum().sum() > 0:
        fig, ax = plt.subplots()
        sns.heatmap(df.isnull(), cbar=False, ax=ax)
        visualizations['missing_data'] = plot_to_base64(fig)
        plt.close(fig)  # Important: close the figure to free memory
    
    # Numeric distributions (first 3 columns)
    numeric_cols = df.select_dtypes(include=[np.number]).columns[:3]
    for col in numeric_cols:
        fig, ax = plt.subplots()
        df[col].hist(ax=ax)
        visualizations[f'distribution_{col}'] = plot_to_base64(fig)
        plt.close(fig)  # Important: close the figure
    
    return visualizations

def plot_to_base64(fig):
    """Convert matplotlib figure to base64 without GUI"""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', dpi=100)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    buf.close()
    return img_base64

    
def process_dataset(analysis_id):
    """
    Main function to process uploaded dataset with AI analysis (synchronous version)
    """
    try:
        analysis = DatasetAnalysis.objects.get(id=analysis_id)
        analysis.status = 'processing'
        analysis.save()
        
        # Load and validate dataset
        file_path = analysis.dataset_file.path
        df = load_dataset(file_path)
        
        if df is None:
            raise Exception("Could not load dataset")
        
        # Perform comprehensive analysis
        results = {
            'basic_stats': get_basic_statistics(df),
            'quality_analysis': analyze_data_quality(df),
            'anomaly_detection': detect_anomalies(df),
            'bias_analysis': analyze_bias(df),
            'insights': generate_insights(df),
            'visualizations': create_visualizations(df)
        }
        
        # Update analysis record
        analysis.quality_score = results['quality_analysis']['overall_score']
        analysis.anomaly_count = results['anomaly_detection']['total_anomalies']
        analysis.bias_score = results['bias_analysis']['overall_bias_score']
        analysis.dataset_size = f"{df.shape[0]} rows, {df.shape[1]} columns"
        analysis.key_insights = results['insights']
        analysis.visualization_data = results['visualizations']
        analysis.status = 'completed'
        analysis.save()
        
        return results
        
    except Exception as e:
        logger.error(f"Analysis {analysis_id} failed: {str(e)}")
        analysis.status = 'failed'
        analysis.save()
        raise

