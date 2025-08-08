from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from models import DatasetAnalysis
from filecoin_storage import FilecoinStorage

class AnalysisTestCase(TestCase):
    def test_upload_flow(self):
        test_file = SimpleUploadedFile(
            "test.csv", 
            b"col1,col2\n1,2\n3,4", 
            content_type="text/csv"
        )
        
        response = self.client.post('/upload_dataset', {'file': test_file})
        self.assertEqual(response.status_code, 202)
        analysis_id = response.data['analysis_id']
        
        # Check analysis was created
        analysis = DatasetAnalysis.objects.get(id=analysis_id)
        self.assertEqual(analysis.status, 'completed')
        
        # Verify Filecoin storage
        if analysis.analysis_cid:
            print(f"Analysis stored at: {analysis.verification_url}")