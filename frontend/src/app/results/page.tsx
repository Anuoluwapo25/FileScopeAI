'use client'
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  CheckCircle, AlertTriangle, Shield, 
  Database, ArrowLeft, Download, Eye, Target, Award, 
  Bell, Info, Verified, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface StoredAnalysisData {
  results: {
    metadata: {
      fileName: string;
      uploadDate: string;
      fileSize: string;
      rows: number;
      columns: number;
      processingTime: string;
      ipfsHash: string;
      contractAddress: string;
      blockNumber: string;
      isPublic: boolean;
    };
    qualityScore: {
      overall: number;
      completeness: number;
      consistency: number;
      accuracy: number;
      validity: number;
    };
    anomalies: {
      total: number;
      high: number;
      medium: number;
      low: number;
      details: Array<{
        column: string;
        type: string;
        count: number;
        severity: string;
        description: string;
        recommendation: string;
      }>;
    };
    biasMetrics: {
      overall: number;
      geographic: { score: number; status: string; description: string };
      demographic: { score: number; status: string; description: string };
    };
    insights: Array<{
      type: string;
      title: string;
      description: string;
      action: string;
    }>;
  };
  fileName: string;
  fileSize: number;
  analysisId: string | number;
  timestamp: string;
  isPublic: boolean;
}

const ResultsPage = () => {
  const [analysisData, setAnalysisData] = useState<StoredAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { isConnected } = useAccount();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Set mounted state after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check wallet connection on mount
  useEffect(() => {
    if (mounted && !isConnected) {
      toast.error('Please connect your wallet to view results', {
        duration: 4000,
        icon: '🔒',
      });
      router.push('/');
    }
  }, [isConnected, router, mounted]);

  // Load analysis results from sessionStorage
  useEffect(() => {
    const loadResults = () => {
      if (!mounted || !isConnected) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const storedData = sessionStorage.getItem('analysisResults');
        if (!storedData) {
          setError('No analysis results found. Please upload and analyze a dataset first.');
          setLoading(false);
          return;
        }
        
        const parsedData: StoredAnalysisData = JSON.parse(storedData);
        console.log('📊 Loaded analysis results:', parsedData);
        setAnalysisData(parsedData);
        setLoading(false);
        
      } catch (error) {
        console.error('Failed to load analysis results:', error);
        setError('Failed to load results. The data may be corrupted.');
        setLoading(false);
      }
    };

    loadResults();
  }, [mounted, isConnected]);

  // Helper functions
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800';
    return 'text-red-600 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
  };

  const getInsightIcon = (type: string) => {
    const icons: Record<string, React.ComponentType<{ className?: string }>> = { 
      critical: AlertTriangle,
      warning: Bell,
      success: CheckCircle,
      info: Info
    };
    return icons[type] || Info;
  };

  const getInsightColor = (type: string) => {
    const colors: Record<string, string> = {
      critical: 'text-red-600 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
      warning: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
      success: 'text-green-600 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
      info: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
    };
    return colors[type] || colors.info;
  };

  

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Function to export analysis results
  const exportResults = (format: 'pdf' | 'csv' | 'json') => {
    if (!analysisData || !analysisData.results) {
      toast.error('No analysis data available to export');
      return;
    }

    try {
      const results = analysisData.results;
      const timestamp = new Date().toISOString().slice(0, 10);
      const baseFileName = `filescope_analysis_${analysisData.fileName.replace(/\.[^/.]+$/, '')}_${timestamp}`;

      switch (format) {
        case 'pdf':
          // Create a formatted HTML string that will be converted to PDF
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>FileScope AI Analysis Report</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .header { text-align: center; margin-bottom: 30px; }
                .section { margin-bottom: 20px; }
                .metric { margin: 10px 0; }
                .table { width: 100%; border-collapse: collapse; }
                .table td, .table th { border: 1px solid #ddd; padding: 8px; }
                .highlight { background-color: #f0f0f0; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>FileScope AI Analysis Report</h1>
                <p>Generated on ${new Date().toLocaleDateString()}</p>
              </div>

              <div class="section">
                <h2>Dataset Information</h2>
                <p>File Name: ${results.metadata.fileName}</p>
                <p>Size: ${results.metadata.fileSize}</p>
                <p>Rows: ${results.metadata.rows}</p>
                <p>Columns: ${results.metadata.columns}</p>
                <p>Analysis ID: ${analysisData.analysisId}</p>
                <p>Processing Time: ${results.metadata.processingTime}</p>
              </div>

              <div class="section">
                <h2>Quality Metrics</h2>
                <p>Overall Score: ${results.qualityScore.overall}%</p>
                <ul>
                  <li>Completeness: ${results.qualityScore.completeness}%</li>
                  <li>Consistency: ${results.qualityScore.consistency}%</li>
                  <li>Accuracy: ${results.qualityScore.accuracy}%</li>
                  <li>Validity: ${results.qualityScore.validity}%</li>
                </ul>
              </div>

              <div class="section">
                <h2>Anomaly Detection</h2>
                <p>Total Anomalies: ${results.anomalies.total}</p>
                <ul>
                  <li>High Priority: ${results.anomalies.high}</li>
                  <li>Medium Priority: ${results.anomalies.medium}</li>
                  <li>Low Priority: ${results.anomalies.low}</li>
                </ul>
                ${results.anomalies.details.map(detail => `
                  <div class="highlight">
                    <h4>${detail.column} (${detail.severity})</h4>
                    <p>${detail.description}</p>
                    <p><strong>Recommendation:</strong> ${detail.recommendation}</p>
                  </div>
                `).join('')}
              </div>

              <div class="section">
                <h2>Bias Analysis</h2>
                <p>Overall Bias Score: ${Math.round(results.biasMetrics.overall * 100)}%</p>
                <div class="highlight">
                  <h4>Geographic Bias</h4>
                  <p>Score: ${Math.round((1 - results.biasMetrics.geographic.score) * 100)}%</p>
                  <p>Status: ${results.biasMetrics.geographic.status}</p>
                  <p>${results.biasMetrics.geographic.description}</p>
                </div>
                <div class="highlight">
                  <h4>Demographic Bias</h4>
                  <p>Score: ${Math.round((1 - results.biasMetrics.demographic.score) * 100)}%</p>
                  <p>Status: ${results.biasMetrics.demographic.status}</p>
                  <p>${results.biasMetrics.demographic.description}</p>
                </div>
              </div>

              <div class="section">
                <h2>AI Insights</h2>
                ${results.insights.map(insight => `
                  <div class="highlight">
                    <h4>${insight.title}</h4>
                    <p>${insight.description}</p>
                    <p><strong>Recommended Action:</strong> ${insight.action}</p>
                  </div>
                `).join('')}
              </div>

              <div class="section">
                <h2>Blockchain Verification</h2>
                <p>IPFS Hash: ${results.metadata.ipfsHash}</p>
                <p>Block Number: ${results.metadata.blockNumber}</p>
                <p>Visibility: ${results.metadata.isPublic ? 'Public' : 'Private'}</p>
              </div>
            </body>
            </html>
          `;

          // Convert HTML to PDF using browser's print functionality
          const printWindow = window.open('', '', 'height=600,width=800');
          if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          }
          toast.success('PDF report generated successfully!');
          break;

        case 'csv':
          // Create CSV content with key metrics and findings
          const csvRows = [
            ['FileScope AI Analysis Report'],
            ['Generated on', new Date().toLocaleDateString()],
            [''],
            ['Dataset Information'],
            ['File Name', results.metadata.fileName],
            ['Size', results.metadata.fileSize],
            ['Rows', results.metadata.rows],
            ['Columns', results.metadata.columns],
            ['Analysis ID', analysisData.analysisId],
            ['Processing Time', results.metadata.processingTime],
            [''],
            ['Quality Metrics'],
            ['Metric', 'Score'],
            ['Overall Quality', `${results.qualityScore.overall}%`],
            ['Completeness', `${results.qualityScore.completeness}%`],
            ['Consistency', `${results.qualityScore.consistency}%`],
            ['Accuracy', `${results.qualityScore.accuracy}%`],
            ['Validity', `${results.qualityScore.validity}%`],
            [''],
            ['Anomalies'],
            ['Priority', 'Count'],
            ['High', results.anomalies.high],
            ['Medium', results.anomalies.medium],
            ['Low', results.anomalies.low],
            [''],
            ['Detailed Anomalies'],
            ['Column', 'Severity', 'Description', 'Recommendation'],
            ...results.anomalies.details.map(detail => [
              detail.column,
              detail.severity,
              detail.description,
              detail.recommendation
            ]),
            [''],
            ['Bias Metrics'],
            ['Type', 'Score', 'Status', 'Description'],
            ['Geographic', `${Math.round((1 - results.biasMetrics.geographic.score) * 100)}%`, 
             results.biasMetrics.geographic.status, results.biasMetrics.geographic.description],
            ['Demographic', `${Math.round((1 - results.biasMetrics.demographic.score) * 100)}%`,
             results.biasMetrics.demographic.status, results.biasMetrics.demographic.description],
            [''],
            ['AI Insights'],
            ['Type', 'Title', 'Description', 'Action'],
            ...results.insights.map(insight => [
              insight.type,
              insight.title,
              insight.description,
              insight.action
            ])
          ];

          const csvContent = csvRows.map(row => row.map(cell => 
            `"${String(cell).replace(/"/g, '""')}"`
          ).join(',')).join('\n');

          const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const csvUrl = URL.createObjectURL(csvBlob);
          const link = document.createElement('a');
          link.href = csvUrl;
          link.download = `${baseFileName}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(csvUrl);
          toast.success('CSV report exported successfully!');
          break;

        case 'json':
          // Export full JSON data
          const jsonData = {
            metadata: {
              ...results.metadata,
              analysisId: analysisData.analysisId,
              timestamp: analysisData.timestamp
            },
            analysis: {
              qualityScore: results.qualityScore,
              anomalies: results.anomalies,
              biasMetrics: results.biasMetrics,
              insights: results.insights
            }
          };

          const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
          const jsonUrl = URL.createObjectURL(jsonBlob);
          const jsonLink = document.createElement('a');
          jsonLink.href = jsonUrl;
          jsonLink.download = `${baseFileName}.json`;
          document.body.appendChild(jsonLink);
          jsonLink.click();
          document.body.removeChild(jsonLink);
          URL.revokeObjectURL(jsonUrl);
          toast.success('JSON data exported successfully!');
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export analysis results');
    }
  };

  // Don't render if wallet is not connected
  if (!mounted || !isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Loading...</h1>
            <p className="text-gray-600 dark:text-gray-300">Please wait while we check your wallet connection.</p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Loading Results...</h1>
            <p className="text-gray-600 dark:text-gray-300">Loading your analysis results...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">No Results Found</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
            <Link 
              href="/upload"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Dataset
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show results if data exists
  if (!analysisData) return null;

  const { results } = analysisData;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Results Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                href="/upload"
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{results.metadata.fileName}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Analysis completed successfully</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <Verified className="w-5 h-5 text-green-600" />
                <span>AI Verified</span>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                {results.metadata.isPublic ? (
                  <>
                    <Eye className="w-5 h-5 text-blue-600" />
                    <span>Public Dataset</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 text-gray-600" />
                    <span>Private Dataset</span>
                  </>
                )}
              </div>
              
              
            </div>
          </div>
        </div>
      </div>

      {/* Results Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-blue-600" />
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getScoreColor(results.qualityScore.overall)}`}>
                {results.qualityScore.overall}%
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Quality Score</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Overall dataset quality</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="px-3 py-1 rounded-full text-sm font-medium bg-red-50 dark:bg-red-900/30 text-red-600 border border-red-200 dark:border-red-800">
                {results.anomalies.total}
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Anomalies</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{results.anomalies.high} require attention</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getScoreColor(Math.round((1 - results.biasMetrics.overall) * 100))}`}>
                {Math.round((1 - results.biasMetrics.overall) * 100)}%
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Bias Score</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Lower is better</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Database className="w-6 h-6 text-green-600" />
              </div>
              <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-50 dark:bg-green-900/30 text-green-600 border border-green-200 dark:border-green-800">
                {results.metadata.rows.toLocaleString()}
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Dataset Size</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{results.metadata.columns} columns</p>
          </div>
        </div>

        {/* Detailed Quality Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Quality Breakdown</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{results.qualityScore.completeness}%</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Completeness</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Data coverage</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">{results.qualityScore.consistency}%</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Consistency</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Format uniformity</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">{results.qualityScore.accuracy}%</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Accuracy</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Data correctness</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-2">{results.qualityScore.validity}%</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">Validity</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Schema compliance</div>
            </div>
          </div>
        </div>

        {/* Anomaly Details */}
        {results.anomalies.total > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Anomaly Analysis</h3>
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
                <div className="text-2xl font-bold text-red-600 mb-2">{results.anomalies.high}</div>
                <div className="text-sm font-medium text-red-800 dark:text-red-200">High Priority</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600 mb-2">{results.anomalies.medium}</div>
                <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Medium Priority</div>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 mb-2">{results.anomalies.low}</div>
                <div className="text-sm font-medium text-blue-800 dark:text-blue-200">Low Priority</div>
              </div>
            </div>
            
            {results.anomalies.details.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 dark:text-white">Detailed Findings:</h4>
                {results.anomalies.details.slice(0, 5).map((detail, index) => (
                  <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">{detail.column}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        detail.severity === 'high' ? 'bg-red-100 text-red-800' :
                        detail.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {detail.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{detail.description}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      Recommendation: {detail.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Insights */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">AI-Generated Insights</h3>
                  <div className="grid gap-4">
            {results.insights.map((insight, index) => {
                      const Icon = getInsightIcon(insight.type);
                      return (
                        <div key={index} className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}>
                          <div className="flex items-start space-x-3">
                            <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="font-semibold mb-1">{insight.title}</h4>
                              <p className="text-sm mb-2">{insight.description}</p>
                              <p className="text-sm font-medium">Action: {insight.action}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

        {/* Blockchain Verification */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Blockchain Verification</h3>
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-800 mb-6">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                <h4 className="font-semibold text-green-900 dark:text-green-100">Analysis Verified</h4>
                <p className="text-green-700 dark:text-green-300 text-sm">Results stored on Filecoin with cryptographic proof</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
            {/* <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">IPFS Hash</h4>
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-sm bg-white dark:bg-gray-800 p-2 rounded font-mono break-all text-gray-700 dark:text-gray-300">
                  {results.metadata.ipfsHash}
                            </code>
                            <button 
                  onClick={() => copyToClipboard(results.metadata.ipfsHash)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex-shrink-0"
                  title="Copy IPFS hash"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
            </div> */}
            
            {/* <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Smart Contract</h4>
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-sm bg-white dark:bg-gray-800 p-2 rounded font-mono text-gray-700 dark:text-gray-300">
                  {results.metadata.contractAddress}
                            </code>
                            <button 
                  onClick={() => copyToClipboard(results.metadata.contractAddress)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
            </div> */}
          </div>
          
          {/* Analysis Metadata */}
          <div className="grid md:grid-cols-3 gap-6 mt-6">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">Analysis ID: {analysisData.analysisId}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Unique identifier</div>
                        </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{formatFileSize(analysisData.fileSize)}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Original file size</div>
                        </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{results.metadata.processingTime}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Processing time</div>
                      </div>
                    </div>
                  </div>

        {/* Bias Analysis Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Bias Analysis</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Geographic Bias</h4>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">Score</span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(Math.round((1 - results.biasMetrics.geographic.score) * 100))}`}>
                  {Math.round((1 - results.biasMetrics.geographic.score) * 100)}%
                </span>
                        </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600 dark:text-gray-300">Status</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{results.biasMetrics.geographic.status}</span>
                        </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{results.biasMetrics.geographic.description}</p>
                      </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Demographic Bias</h4>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">Score</span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(Math.round((1 - results.biasMetrics.demographic.score) * 100))}`}>
                  {Math.round((1 - results.biasMetrics.demographic.score) * 100)}%
                </span>
                        </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600 dark:text-gray-300">Status</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{results.biasMetrics.demographic.status}</span>
                        </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{results.biasMetrics.demographic.description}</p>
                        </div>
                      </div>
          
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Overall Bias Assessment</h5>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Your dataset shows an overall bias score of {Math.round(results.biasMetrics.overall * 100)}%. 
                  Lower scores indicate less bias, making the dataset more suitable for fair AI applications.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Analysis Complete!</h3>
              <p className="text-gray-600 dark:text-gray-400">Your dataset has been thoroughly analyzed and verified on the blockchain.</p>
            </div>
            <div className="flex space-x-4">
              <div className="relative group">
                <button
                  onClick={() => exportResults('pdf')}
                  className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Export as PDF</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 hidden group-hover:block">
                  <button
                    onClick={() => exportResults('csv')}
                    className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => exportResults('json')}
                    className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Export as JSON
                  </button>
                </div>
              </div>
              <button 
                onClick={() => {
                  sessionStorage.removeItem('analysisResults');
                  router.push('/upload');
                }}
                className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                Analyze Another
              </button>
              <Link
                href="/explorer"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center space-x-2"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Explore Datasets</span>
              </Link>
            </div>
          </div>
        </div>

        
      </div>

      {/* Copy notification */}
      {/* Copy notification removed - functionality not implemented */}
    </div>
  );
};

export default ResultsPage;