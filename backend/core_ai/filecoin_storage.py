# filecoin_storage.py
import requests
import json
import os
from django.conf import settings
from django.core.files.base import ContentFile
import logging

logger = logging.getLogger(__name__)

class FilecoinStorage:
    """
    Handle Filecoin/IPFS storage operations using Web3.Storage or Lighthouse
    """
    
    def __init__(self):
        self.web3_storage_token = getattr(settings, 'WEB3_STORAGE_TOKEN', None)
        self.lighthouse_token = getattr(settings, 'LIGHTHOUSE_TOKEN', None)
        self.web3_storage_url = "https://api.web3.storage"
        self.lighthouse_url = "https://node.lighthouse.storage"
    
    def upload_to_web3_storage(self, file_path, filename):
        """
        Upload file to Web3.Storage (IPFS + Filecoin)
        """
        if not self.web3_storage_token:
            raise ValueError("Web3.Storage token not configured")
        
        try:
            headers = {
                'Authorization': f'Bearer {self.web3_storage_token}',
            }
            
            with open(file_path, 'rb') as file:
                files = {'file': (filename, file, 'application/octet-stream')}
                response = requests.post(
                    f"{self.web3_storage_url}/upload",
                    headers=headers,
                    files=files
                )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    'success': True,
                    'cid': result.get('cid'),
                    'url': f"https://{result.get('cid')}.ipfs.w3s.link"
                }
            else:
                logger.error(f"Web3.Storage upload failed: {response.text}")
                return {'success': False, 'error': response.text}
                
        except Exception as e:
            logger.error(f"Web3.Storage upload error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def upload_to_lighthouse(self, file_path, filename):
        """
        Upload file to Lighthouse (IPFS + Filecoin)
        """
        if not self.lighthouse_token:
            raise ValueError("Lighthouse token not configured")
        
        try:
            headers = {
                'Authorization': f'Bearer {self.lighthouse_token}',
            }
            
            with open(file_path, 'rb') as file:
                files = {'file': (filename, file)}
                response = requests.post(
                    f"{self.lighthouse_url}/api/v0/add",
                    headers=headers,
                    files=files
                )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    'success': True,
                    'cid': result.get('Hash'),
                    'url': f"https://gateway.lighthouse.storage/ipfs/{result.get('Hash')}"
                }
            else:
                logger.error(f"Lighthouse upload failed: {response.text}")
                return {'success': False, 'error': response.text}
                
        except Exception as e:
            logger.error(f"Lighthouse upload error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def upload_analysis_results(self, analysis_id, results_data):
        """
        Upload analysis results as JSON to Filecoin
        """
        try:
            # Create JSON file with results
            json_content = json.dumps(results_data, indent=2, default=str)
            temp_filename = f"analysis_{analysis_id}_results.json"
            temp_path = f"/tmp/{temp_filename}"
            
            with open(temp_path, 'w') as f:
                f.write(json_content)
            
            # Try Web3.Storage first, fallback to Lighthouse
            if self.web3_storage_token:
                result = self.upload_to_web3_storage(temp_path, temp_filename)
            elif self.lighthouse_token:
                result = self.upload_to_lighthouse(temp_path, temp_filename)
            else:
                result = {'success': False, 'error': 'No storage provider configured'}
            
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            return result
            
        except Exception as e:
            logger.error(f"Error uploading analysis results: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def pin_content(self, cid):
        """
        Pin content to ensure persistence
        """
        try:
            if self.web3_storage_token:
                headers = {
                    'Authorization': f'Bearer {self.web3_storage_token}',
                    'Content-Type': 'application/json'
                }
                
                data = {'cid': cid}
                response = requests.post(
                    f"{self.web3_storage_url}/pins",
                    headers=headers,
                    json=data
                )
                
                return response.status_code == 200
            
            return False
            
        except Exception as e:
            logger.error(f"Error pinning content: {str(e)}")
            return False

# Updated tasks.py with Filecoin integration
from .filecoin_storage import FilecoinStorage

def process_dataset_async(self, analysis_id):
    """
    Main task to process uploaded dataset with AI analysis and Filecoin storage
    """
    try:
        analysis = DatasetAnalysis.objects.get(id=analysis_id)
        analysis.status = 'processing'
        analysis.save()
        
        # Download and read the dataset
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
            'visualizations': create_visualizations(df),
            'metadata': {
                'analysis_id': analysis_id,
                'timestamp': analysis.uploaded_at.isoformat(),
                'user_id': analysis.user.id if analysis.user else None,
                'original_filename': os.path.basename(analysis.dataset_file.name)
            }
        }
        
        # Store analysis results on Filecoin
        filecoin_storage = FilecoinStorage()
        storage_result = filecoin_storage.upload_analysis_results(analysis_id, results)
        
        if storage_result['success']:
            analysis.analysis_cid = storage_result['cid']
            analysis.verification_url = storage_result['url']
            
            # Try to pin the content for persistence
            filecoin_storage.pin_content(storage_result['cid'])
        
        # Also try to store the original dataset on Filecoin
        try:
            dataset_filename = f"dataset_{analysis_id}_{os.path.basename(analysis.dataset_file.name)}"
            dataset_storage_result = filecoin_storage.upload_to_web3_storage(file_path, dataset_filename)
            
            if dataset_storage_result['success']:
                analysis.dataset_cid = dataset_storage_result['cid']
        except Exception as e:
            logger.warning(f"Could not store original dataset on Filecoin: {str(e)}")
        
        # Update analysis record
        analysis.quality_score = results['quality_analysis']['overall_score']
        analysis.anomaly_count = results['anomaly_detection']['total_anomalies']
        analysis.bias_score = results['bias_analysis']['overall_bias_score']
        analysis.dataset_size = f"{df.shape[0]} rows, {df.shape[1]} columns"
        analysis.key_insights = results['insights']
        analysis.visualization_data = results['visualizations']
        analysis.status = 'completed'
        analysis.save()
        
        logger.info(f"Analysis {analysis_id} completed successfully")
        return results
        
    except Exception as e:
        logger.error(f"Analysis {analysis_id} failed: {str(e)}")
        try:
            analysis = DatasetAnalysis.objects.get(id=analysis_id)
            analysis.status = 'failed'
            analysis.save()
        except:
            pass
        raise e