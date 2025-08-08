from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

class DatasetAnalysis(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, 
        blank=True  
    )
    dataset_file = models.FileField(upload_to='datasets/')


    uploaded_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Analysis results
    quality_score = models.FloatField(null=True, blank=True, default=100)
    anomaly_count = models.IntegerField(null=True, blank=True, default=0)
    bias_score = models.FloatField(null=True, blank=True, default=100)
    dataset_size = models.CharField(max_length=100, blank=True, default=100)
    

    critical_anomalies = models.IntegerField(default=0)
    moderate_anomalies = models.IntegerField(default=0)
    anomaly_examples = models.JSONField(default=list)
    validity_score = models.FloatField(null=True)
    validity_issues = models.IntegerField(default=0)
    missing_values_pct = models.FloatField(default=0)
    duplicate_count = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    processing_time = models.CharField(max_length=20, blank=True)
    # Filecoin storage
    dataset_cid = models.CharField(max_length=100, blank=True)
    analysis_cid = models.CharField(max_length=100, blank=True)
    verification_url = models.URLField(blank=True)
    full_analysis = models.JSONField(default=dict)
    quality_score = models.FloatField(default=0)
    rows_count = models.IntegerField(default=0)
    columns_count = models.IntegerField(default=0)
    full_analysis = models.JSONField(default=dict)




    
    # Insights
    key_insights = models.JSONField(default=dict, blank=True)
    visualization_data = models.JSONField(default=dict, blank=True)
    full_analysis = models.JSONField(default=dict)
    
    def __str__(self):
        return f"Analysis #{self.id} - {self.status}"
    
    def get_analysis_report(self):
        return {
            "metadata": self._get_metadata(),
            "data_profile": self.full_analysis.get("data_profile", {}),
            "quality_metrics": self._get_quality_metrics(),
            "advanced_analysis": self._get_advanced_analysis()
        }
    
    def _get_metadata(self):
        return {
            "dataset_id": str(self.id),
            "file_name": self.file_name,
            "dimensions": f"{self.rows_count} rows × {self.columns_count} columns",
            "upload_date": self.uploaded_at.isoformat(),
            "processing_time": self.full_analysis.get("processing_time")
        }
    
    def _get_quality_metrics(self):
        return {
            "overall_score": self.quality_score,
            "completeness": self.full_analysis.get("completeness_score"),
            "duplicates": self.full_analysis.get("duplicate_analysis"),
            "anomalies": self.full_analysis.get("anomaly_analysis"),
            "schema_validation": self.full_analysis.get("schema_issues")
        }
    
    def _get_advanced_analysis(self):
        return {
            "correlations": self.full_analysis.get("correlation_matrix"),
            "bias_assessment": self.full_analysis.get("bias_analysis"),
            "nlp_insights": self.full_analysis.get("text_analysis"),
            "visualization_suggestions": self.visualizations
        }