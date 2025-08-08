import requests
import time
import json

class FileScopeClient:
    """
    Example client showing how to interact with FileScope AI
    """
    
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')
        
    def upload_dataset(self, file_path):
        """
        Upload dataset for AI analysis
        """
        url = f"{self.base_url}/api/upload/"
        
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(url, files=files, headers=self.headers)
        
        if response.status_code == 202:
            return response.json()
        else:
            raise Exception(f"Upload failed: {response.text}")
    
    def check_analysis_status(self, analysis_id):
        """
        Check analysis status
        """
        url = f"{self.base_url}/api/analysis/{analysis_id}/status/"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Status check failed: {response.text}")
    
    def wait_for_completion(self, analysis_id, max_wait=600):
        """
        Wait for analysis to complete
        """
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            status_data = self.check_analysis_status(analysis_id)
            status = status_data['status']
            
            print(f"Status: {status}")
            
            if status == 'completed':
                return status_data
            elif status == 'failed':
                raise Exception("Analysis failed")
            
            time.sleep(10)  # Wait 10 seconds before checking again
        
        raise Exception("Analysis timed out")
    
    def get_public_analysis(self, cid):
        """
        Get public analysis by CID (no authentication needed)
        """
        url = f"{self.base_url}/api/public/{cid}/"
        response = requests.get(url)  # No auth headers for public access
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Public access failed: {response.text}")

# Example usage
def main():
    # Initialize client
    client = FileScopeClient(
        base_url="http://localhost:8000",
    )
    
    print("=== FileScope AI Example ===\n")
    
    # 1. Upload dataset
    print("1. Uploading dataset...")
    upload_result = client.upload_dataset("sample_data.csv")
    analysis_id = upload_result['analysis_id']
    print(f"   Analysis ID: {analysis_id}")
    print(f"   Status: {upload_result['status']}\n")
    
    # 2. Wait for analysis to complete
    print("2. Waiting for AI analysis to complete...")
    final_result = client.wait_for_completion(analysis_id)
    print("   Analysis completed!\n")
    
    # 3. Display results
    results = final_result['results']
    print("3. Analysis Results:")
    print(f"   Quality Score: {results['quality_score']}/100")
    print(f"   Anomalies Found: {results['anomaly_count']}")
    print(f"   Bias Score: {results['bias_score']}/100")
    print(f"   Dataset Size: {results['dataset_size']}")
    
    # 4. Filecoin storage info
    filecoin = results['filecoin_storage']
    print(f"\n4. Filecoin Storage:")
    print(f"   Analysis CID: {filecoin['analysis_cid']}")
    print(f"   Dataset CID: {filecoin.get('dataset_cid', 'Not stored')}")
    print(f"   Verification URL: {filecoin['verification_url']}")
    
    # 5. Display insights
    insights = results['insights']
    print(f"\n5. AI Insights:")
    print(f"   Summary: {insights['summary']}")
    print(f"   Key Findings:")
    for finding in insights['key_findings'][:3]:
        print(f"     • {finding}")
    
    # 6. Test public access (anyone can do this)
    print(f"\n6. Testing Public Access...")
    cid = filecoin['analysis_cid']
    public_result = client.get_public_analysis(cid)
    print(f"   ✅ Public verification successful!")
    print(f"   ✅ Anyone can access via CID: {cid}")
    
    # 7. Show access URLs
    print(f"\n7. Public Access URLs:")
    print(f"   IPFS Gateway: https://ipfs.io/ipfs/{cid}")
    print(f"   Cloudflare: https://cloudflare-ipfs.com/ipfs/{cid}")
    print(f"   Web3.Storage: {filecoin['verification_url']}")
    print(f"   FileScope API: /api/public/{cid}/")
    
    print(f"\n=== Complete! Your analysis is permanently stored on Filecoin ===")

# Real-world integration example
class DatasetAnalyzer:
    """
    Example of integrating FileScope AI into your application
    """
    
    def __init__(self, filescope_client):
        self.client = filescope_client
    
    def analyze_and_verify(self, dataset_path, quality_threshold=70):
        """
        Analyze dataset and verify it meets quality standards
        """
        # Upload and analyze
        upload_result = self.client.upload_dataset(dataset_path)
        analysis_id = upload_result['analysis_id']
        
        # Wait for completion
        result = self.client.wait_for_completion(analysis_id)
        
        # Check quality
        quality_score = result['results']['quality_score']
        
        if quality_score >= quality_threshold:
            return {
                'approved': True,
                'quality_score': quality_score,
                'filecoin_cid': result['results']['filecoin_storage']['analysis_cid'],
                'verification_url': result['results']['filecoin_storage']['verification_url']
            }
        else:
            return {
                'approved': False,
                'quality_score': quality_score,
                'issues': result['results']['insights']['recommendations']
            }
    
    def batch_analyze(self, dataset_paths):
        """
        Analyze multiple datasets
        """
        results = []
        
        for path in dataset_paths:
            try:
                result = self.analyze_and_verify(path)
                results.append({
                    'dataset': path,
                    'success': True,
                    'result': result
                })
            except Exception as e:
                results.append({
                    'dataset': path,
                    'success': False,
                    'error': str(e)
                })
        
        return results

