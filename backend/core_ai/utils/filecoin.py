from web3.storage import Client
from django.conf import settings
import json

def store_to_filecoin(data, file_name):
    """Store data to Filecoin via web3.storage"""
    client = Client(settings.WEB3_STORAGE_TOKEN)
    
    if isinstance(data, pd.DataFrame):
        content = data.to_json()
    else:
        content = json.dumps(data)
    
    cid = client.put(content, name=file_name)
    return f"ipfs://{cid}"

def store_analysis(dataset_path, analysis_results):
    """Store both dataset and analysis results"""
    # Store original dataset
    with open(dataset_path, 'rb') as f:
        dataset_content = f.read()
    dataset_cid = store_to_filecoin(dataset_content, "dataset")
    
    # Store analysis results
    analysis_cid = store_to_filecoin(analysis_results, "analysis")
    
    return dataset_cid, analysis_cid