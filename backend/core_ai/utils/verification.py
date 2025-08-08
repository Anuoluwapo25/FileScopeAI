from web3 import Web3
from django.conf import settings

def verify_analysis(dataset_cid, analysis_cid):
    """Verify analysis on blockchain"""
    # Connect to FVM (using Polygon as example)
    w3 = Web3(Web3.HTTPProvider(settings.FVM_RPC_URL))
    
    # Load contract ABI and address
    contract = w3.eth.contract(
        address=settings.CONTRACT_ADDRESS,
        abi=settings.CONTRACT_ABI
    )
    
    # Call verification function
    result = contract.functions.verifyAnalysis(
        dataset_cid,
        analysis_cid
    ).call()
    
    return {
        'verified': result[0],
        'block_number': result[1],
        'timestamp': result[2],
        'verification_url': f"{settings.BLOCK_EXPLORER}/tx/{result[3]}"
    }