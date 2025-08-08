'use client'
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { useRouter } from 'next/navigation';
import { 
  Search, Filter, Grid, List, Calendar, User,
  Database, Eye, Download, CheckCircle, BarChart3, FileText,
  Verified, ArrowRight, ChevronDown, X, Copy, ArrowLeft, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fileStoreContract } from '../index';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Blockchain contract dataset structure
interface ContractDataset {
  datasetCID: string;
  analysisCID: string;
  uploader: string;
  isPublic: boolean;
  timestamp: bigint;
  views: bigint;
  downloads: bigint;
  citations: bigint;
}

// Add proper types for the data
interface DatasetMetadata {
  fileName: string;
  fileSize: string;
  rows: number;
  columns: number;
  uploadDate: string;
  ipfsHash: string;
  contractAddress: string;
  blockNumber: string;
  isPublic: boolean;
  description?: string;
  tags?: string[];
  format?: string;
}

interface DatasetResults {
  metrics: {
    quality_score: number;
    completeness: number;
    consistency: number;
    accuracy: number;
    validity: number;
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
    bias_metrics: {
      overall: number;
      geographic: { score: number; status: string; description: string };
      demographic: { score: number; status: string; description: string };
    };
  };
  insights: Array<{
    type: string;
    title: string;
    description: string;
    action: string;
  }>;
  metadata?: {
    fileName?: string;
    fileSize?: string;
    file_size?: string;
    rows?: number;
    columns?: number;
    description?: string;
    tags?: string[];
    format?: string;
  };
}

interface Dataset {
  id: number;
  title: string;
  description: string;
  category: string;
  metadata: DatasetMetadata;
  results: DatasetResults;
  stats: {
    views: number;
    downloads: number;
    citations: number;
  };
  uploader: {
    address: string;
    name: string;
    reputation: number;
    verified: boolean;
  };
  analysis: {
    verified: boolean;
  };
}

const DatasetExplorer = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [filters, setFilters] = useState({
    minQuality: 0,
    maxQuality: 100,
    dateRange: 'all',
    verified: 'all',
    fileType: 'all'
  });
  const [mounted, setMounted] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Wallet connection check
  const { isConnected } = useAccount();
  const router = useRouter();

  // Blockchain contract hooks
  const { data: contractDatasets, isLoading: contractLoading, error: contractError } = useReadContract({
    address: fileStoreContract.address as `0x${string}`,
    abi: fileStoreContract.abi,
    functionName: 'getAllPublicDatasets',
  });

  const { writeContract: incrementViews } = useWriteContract();
  const { writeContract: incrementDownloads } = useWriteContract();

  // Set mounted state after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check wallet connection on mount
  useEffect(() => {
    if (mounted && !isConnected) {
      toast.error('Please connect your wallet to explore datasets', {
        duration: 4000,
        icon: '🔒',
      });
      router.push('/');
    }
  }, [isConnected, router, mounted]);

  // Fetch public datasets from blockchain and IPFS
  useEffect(() => {
    const fetchPublicDatasets = async () => {
      if (!mounted || !isConnected) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 Fetching public datasets from blockchain...');
        
        if (contractError) {
          throw new Error(`Contract error: ${contractError.message}`);
        }
        
        if (!contractDatasets || !Array.isArray(contractDatasets) || contractDatasets.length === 0) {
          console.log('📭 No public datasets found on blockchain');
          setDatasets([]);
          setLoading(false);
          return;
        }
        
        console.log(`📊 Found ${contractDatasets.length} public datasets on blockchain`);
        
        // Process each dataset from the contract
        const processedDatasets: Dataset[] = [];
        
        for (let i = 0; i < contractDatasets.length; i++) {
          const contractData = contractDatasets[i] as ContractDataset; // Assuming contractData is of type ContractDataset
          
          try {
            // Fetch metadata from IPFS using the analysisCID
            const ipfsData = await fetchIPFSData(contractData.analysisCID);
            
            // Create dataset object
            const dataset: Dataset = {
              id: i + 1, // Use index as ID for now
              title: ipfsData?.name || ipfsData?.originalFile?.name || ipfsData?.metadata?.fileName || ipfsData?.metadata?.file_name || ipfsData?.results?.metadata?.fileName || `Dataset ${i + 1}`, // Use actual filename if available
              description: ipfsData?.description || ipfsData?.metadata?.description || ipfsData?.results?.metadata?.description || `AI-analyzed dataset`, // Remove fake quality score
              category: detectCategory(
                ipfsData?.name || ipfsData?.originalFile?.name || ipfsData?.metadata?.fileName || ipfsData?.results?.metadata?.fileName || `Dataset ${i + 1}`,
                ipfsData?.description || ipfsData?.metadata?.description || ipfsData?.results?.metadata?.description || '',
                ipfsData?.metadata?.tags || ipfsData?.results?.metadata?.tags || []
              ),
              metadata: {
                fileName: ipfsData?.name || ipfsData?.originalFile?.name || ipfsData?.metadata?.fileName || ipfsData?.metadata?.file_name || ipfsData?.results?.metadata?.fileName || `Dataset ${i + 1}`,
                fileSize: ipfsData?.originalFile?.size ? `${(ipfsData.originalFile.size / 1024).toFixed(2)} KB` : ipfsData?.metadata?.fileSize || ipfsData?.metadata?.file_size || ipfsData?.results?.metadata?.fileSize || 'Unknown',
                rows: ipfsData?.results?.metadata?.rows || ipfsData?.metadata?.rows || 0,
                columns: ipfsData?.results?.metadata?.columns || ipfsData?.metadata?.columns || 0,
                uploadDate: new Date(Number(contractData.timestamp) * 1000).toISOString(),
                ipfsHash: contractData.analysisCID,
                contractAddress: contractData.uploader, // Assuming uploader is contractAddress
                blockNumber: contractData.timestamp.toString(),
                isPublic: contractData.isPublic,
                description: ipfsData?.description || ipfsData?.metadata?.description || ipfsData?.results?.metadata?.description || 'No description available',
                tags: ipfsData?.metadata?.tags || ipfsData?.results?.metadata?.tags || [],
                format: ipfsData?.originalFile?.type || ipfsData?.metadata?.format || ipfsData?.results?.metadata?.format || 'Unknown'
              },
              results: {
                metrics: {
                  quality_score: ipfsData?.analysis?.qualityScore || ipfsData?.results?.qualityScore?.overall || ipfsData?.results?.metrics?.quality_score || ipfsData?.metrics?.quality_score || 0, // Only use real data
                  completeness: ipfsData?.analysis?.completeness || ipfsData?.results?.qualityScore?.completeness || ipfsData?.results?.metrics?.completeness || ipfsData?.metrics?.completeness || 0, // Only use real data
                  consistency: ipfsData?.analysis?.consistency || ipfsData?.results?.qualityScore?.consistency || ipfsData?.results?.metrics?.consistency || ipfsData?.metrics?.consistency || 0,
                  accuracy: ipfsData?.analysis?.accuracy || ipfsData?.results?.qualityScore?.accuracy || ipfsData?.results?.metrics?.accuracy || ipfsData?.metrics?.accuracy || 0,
                  validity: ipfsData?.analysis?.validity || ipfsData?.results?.qualityScore?.validity || ipfsData?.results?.metrics?.validity || ipfsData?.metrics?.validity || 0,
                  anomalies: ipfsData?.results?.anomalies || ipfsData?.results?.metrics?.anomalies || ipfsData?.metrics?.anomalies || {
                    total: ipfsData?.analysis?.anomalies || 0,
                    high: 0,
                    medium: 0,
                    low: 0,
                    details: []
                  },
                  bias_metrics: ipfsData?.results?.biasMetrics || ipfsData?.results?.metrics?.bias_metrics || ipfsData?.metrics?.bias_metrics || {
                    overall: 0,
                    geographic: { score: 0, status: 'Unknown', description: 'No analysis available' },
                    demographic: { score: 0, status: 'Unknown', description: 'No analysis available' }
                  }
                },
                insights: ipfsData?.results?.insights || ipfsData?.insights || []
              },
              stats: {
                views: Number(contractData.views), // Will be filled from contract
                downloads: Number(contractData.downloads), // Will be filled from contract
                citations: Number(contractData.citations) // Will be filled from contract
              },
              uploader: { // Placeholder uploader info
                address: contractData.uploader,
                name: `${contractData.uploader.slice(0, 6)}...${contractData.uploader.slice(-4)}`,
                reputation: 80,
                verified: true // Assuming blockchain registration implies verification
              },
              analysis: { // Placeholder analysis info
                verified: true
              }
            };
            
            processedDatasets.push(dataset);
            
          } catch (ipfsError) {
            console.error(`Failed to fetch IPFS data for dataset ${i}:`, ipfsError);
            // Add dataset with minimal data if IPFS fetch fails
            const fallbackDataset: Dataset = {
              id: i + 1,
              title: `Dataset ${i + 1}`,
              description: `Dataset ${i + 1} - Analysis data unavailable`,
              category: detectCategory(`Dataset ${i + 1}`, `Dataset ${i + 1} - Analysis data unavailable`, []),
              metadata: {
                fileName: `Dataset ${i + 1}`,
                fileSize: 'Unknown',
                rows: 0,
                columns: 0,
                uploadDate: new Date(Number(contractData.timestamp) * 1000).toISOString(),
                ipfsHash: contractData.analysisCID,
                contractAddress: contractData.uploader,
                blockNumber: contractData.timestamp.toString(),
                isPublic: contractData.isPublic
              },
              results: {
                metrics: {
                  quality_score: 0,
                  completeness: 0,
                  consistency: 0,
                  accuracy: 0,
                  validity: 0,
                  anomalies: {
                    total: 0,
                    high: 0,
                    medium: 0,
                    low: 0,
                    details: []
                  },
                  bias_metrics: {
                    overall: 0,
                    geographic: { score: 0, status: 'Unknown', description: 'No analysis available' },
                    demographic: { score: 0, status: 'Unknown', description: 'No analysis available' }
                  }
                },
                insights: []
              },
              stats: {
                views: 0,
                downloads: 0,
                citations: 0
              },
              uploader: {
                address: contractData.uploader,
                name: 'Uploader Name',
                reputation: 80,
                verified: false
              },
              analysis: {
                verified: false
              }
            };
            
            processedDatasets.push(fallbackDataset);
          }
        }
        
        console.log(`✅ Processed ${processedDatasets.length} datasets`);
        setDatasets(processedDatasets);
        setLoading(false);
        
      } catch (error) {
        console.error('Failed to fetch public datasets:', error);
        setError('Failed to load datasets. Please try again.');
        setLoading(false);
      }
    };

    fetchPublicDatasets();
  }, [mounted, isConnected, contractDatasets, contractError]);

  // Helper function to fetch IPFS data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchIPFSData = async (cid: string): Promise<any> => {
    try {
      console.log('🔍 Fetching IPFS data from CID:', cid);
      const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
      if (!response.ok) {
        throw new Error(`IPFS fetch failed: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('📊 IPFS data received:', JSON.stringify(data, null, 2));
      
      // Return the full data structure for processing
      return data;
    } catch (error) {
      console.error('Failed to fetch IPFS data:', error);
      // Return minimal fallback data - no mock values
      return {
        metadata: {
          fileName: 'Unknown Dataset',
          fileSize: 'Unknown',
          rows: 0,
          columns: 0,
          description: 'Analysis data unavailable',
          format: 'Unknown'
        },
        results: {
          metrics: {
            quality_score: 0,
            completeness: 0,
            consistency: 0,
            accuracy: 0,
            validity: 0,
            anomalies: {
              total: 0,
              high: 0,
              medium: 0,
              low: 0,
              details: []
            },
            bias_metrics: {
              overall: 0,
              geographic: { score: 0, status: 'Unknown', description: 'No analysis available' },
              demographic: { score: 0, status: 'Unknown', description: 'No analysis available' }
            }
          },
          insights: []
        }
      };
    }
  };

  // Download functions
  const downloadOriginalDataset = async (dataset: Dataset) => {
    try {
      console.log('📥 Downloading original dataset...');
      toast.loading('Fetching original dataset from IPFS...', { id: 'download' });
      
      // First, fetch the analysis results to get the original file hash
      const analysisResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${dataset.metadata.ipfsHash}`);
      if (!analysisResponse.ok) {
        throw new Error('Failed to fetch analysis results from IPFS');
      }
      
      const analysisData = await analysisResponse.json();
      
      // Extract the original file hash from the analysis results
      const originalFileHash = analysisData.originalFile?.ipfsHash;
      if (!originalFileHash) {
        throw new Error('Original file not found in analysis results');
      }
      
      console.log('🔍 Found original file hash:', originalFileHash);
      
      // Now fetch the original file using the extracted hash
      const originalFileResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${originalFileHash}`);
      if (!originalFileResponse.ok) {
        throw new Error('Failed to fetch original dataset from IPFS');
      }
      
      const data = await originalFileResponse.blob();
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      
      // Get file information from the analysis results
      const originalFileInfo = analysisData.originalFile;
      let fileExtension = 'json';
      let formatName = 'JSON';
      
      if (originalFileInfo?.type) {
        const contentType = originalFileInfo.type.toLowerCase();
        if (contentType.includes('csv')) {
          fileExtension = 'csv';
          formatName = 'CSV';
        } else if (contentType.includes('excel') || contentType.includes('spreadsheet')) {
          fileExtension = 'xlsx';
          formatName = 'Excel';
        } else if (contentType.includes('json')) {
          fileExtension = 'json';
          formatName = 'JSON';
        } else if (contentType.includes('text/plain')) {
          fileExtension = 'txt';
          formatName = 'Text';
        } else {
          // Try to extract extension from filename
          const fileName = originalFileInfo.name || dataset.title;
          const lastDot = fileName.lastIndexOf('.');
          if (lastDot > 0) {
            fileExtension = fileName.substring(lastDot + 1);
            formatName = fileExtension.toUpperCase();
          }
        }
      }
      
      a.download = originalFileInfo?.name || `${dataset.title || 'dataset'}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Original dataset downloaded as ${formatName}!`, { id: 'download' });
    } catch (error) {
      console.error('Download failed:', error);
      if (error instanceof Error && error.message.includes('Original file not found')) {
        toast.error('Original file not available for this dataset. Try downloading the analysis report instead.', { id: 'download' });
      } else {
        toast.error('Failed to download original dataset. The file might not be available on IPFS.', { id: 'download' });
      }
    }
  };

  const downloadAnalysisResults = async (dataset: Dataset) => {
    try {
      console.log('📊 Downloading analysis results as PDF...');
      toast.loading('Generating analysis report...', { id: 'download' });
      
      // Create a temporary div to render the PDF content
      const pdfContent = document.createElement('div');
      pdfContent.style.position = 'absolute';
      pdfContent.style.left = '-9999px';
      pdfContent.style.top = '0';
      pdfContent.style.width = '800px';
      pdfContent.style.padding = '40px';
      pdfContent.style.backgroundColor = 'white';
      pdfContent.style.fontFamily = 'Arial, sans-serif';
      pdfContent.style.fontSize = '12px';
      pdfContent.style.lineHeight = '1.4';
      
      pdfContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin-bottom: 10px; font-size: 24px;">FileScope AI Analysis Report</h1>
          <p style="color: #6b7280; font-size: 14px;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px;">Dataset Information</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Title:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.title}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Description:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.description}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>File Size:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.metadata.fileSize}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Rows:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.metadata.rows}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Columns:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.metadata.columns}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Upload Date:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(dataset.metadata.uploadDate).toLocaleDateString()}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Uploader:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.uploader.name}</td></tr>
          </table>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px;">AI Analysis Results</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
              <h3 style="color: #1f2937; margin-bottom: 10px;">Quality Metrics</h3>
              <p><strong>Overall Quality:</strong> ${dataset.results?.metrics?.quality_score || 0}%</p>
              <p><strong>Completeness:</strong> ${dataset.results?.metrics?.completeness || 0}%</p>
              <p><strong>Consistency:</strong> ${dataset.results?.metrics?.consistency || 0}%</p>
              <p><strong>Accuracy:</strong> ${dataset.results?.metrics?.accuracy || 0}%</p>
              <p><strong>Validity:</strong> ${dataset.results?.metrics?.validity || 0}%</p>
            </div>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
              <h3 style="color: #1f2937; margin-bottom: 10px;">Anomaly Detection</h3>
              <p><strong>Total Anomalies:</strong> ${dataset.results?.metrics?.anomalies?.total || 0}</p>
              <p><strong>High Priority:</strong> ${dataset.results?.metrics?.anomalies?.high || 0}</p>
              <p><strong>Medium Priority:</strong> ${dataset.results?.metrics?.anomalies?.medium || 0}</p>
              <p><strong>Low Priority:</strong> ${dataset.results?.metrics?.anomalies?.low || 0}</p>
            </div>
          </div>
          
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #1f2937; margin-bottom: 10px;">Bias Assessment</h3>
            <p><strong>Overall Bias Score:</strong> ${dataset.results?.metrics?.bias_metrics?.overall || 0}%</p>
            <p><strong>Geographic Bias:</strong> ${dataset.results?.metrics?.bias_metrics?.geographic?.status || 'Unknown'}</p>
            <p><strong>Demographic Bias:</strong> ${dataset.results?.metrics?.bias_metrics?.demographic?.status || 'Unknown'}</p>
          </div>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px;">Key Insights</h2>
          ${(dataset.results?.insights || []).map((insight, index) => `
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6;">
              <h4 style="color: #1f2937; margin-bottom: 8px;">${insight.title}</h4>
              <p style="color: #4b5563; margin-bottom: 8px;">${insight.description}</p>
              <p style="color: #059669; font-style: italic;"><strong>Action:</strong> ${insight.action}</p>
            </div>
          `).join('')}
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px;">Blockchain Verification</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>IPFS Hash:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${dataset.metadata.ipfsHash}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Contract Address:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${dataset.metadata.contractAddress}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Block Number:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.metadata.blockNumber}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Views:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.stats.views}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Downloads:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.stats.downloads}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Citations:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.stats.citations}</td></tr>
          </table>
        </div>
        
        <div style="text-align: center; color: #6b7280; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p>Generated by FileScope AI Explorer</p>
          <p>This report is cryptographically verified on the Filecoin blockchain</p>
        </div>
      `;
      
      document.body.appendChild(pdfContent);
      
      // Convert to canvas and then to PDF
      const canvas = await html2canvas(pdfContent, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      document.body.removeChild(pdfContent);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`${dataset.title || 'dataset'}_analysis_report.pdf`);
      
      toast.success('Analysis report downloaded as PDF!', { id: 'download' });
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('Failed to generate PDF report. Please try again.', { id: 'download' });
    }
  };

  const downloadCompleteDataset = async (dataset: Dataset) => {
    try {
      console.log('📦 Downloading complete dataset package as PDF...');
      toast.loading('Generating complete dataset report...', { id: 'download' });
      
      // Create a temporary div to render the PDF content
      const pdfContent = document.createElement('div');
      pdfContent.style.position = 'absolute';
      pdfContent.style.left = '-9999px';
      pdfContent.style.top = '0';
      pdfContent.style.width = '800px';
      pdfContent.style.padding = '40px';
      pdfContent.style.backgroundColor = 'white';
      pdfContent.style.fontFamily = 'Arial, sans-serif';
      pdfContent.style.fontSize = '12px';
      pdfContent.style.lineHeight = '1.4';
      
      pdfContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin-bottom: 10px; font-size: 28px;">FileScope AI Complete Dataset Report</h1>
          <p style="color: #6b7280; font-size: 14px;">Complete Analysis Package - Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px;">Dataset Overview</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Title:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.title}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Description:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.description}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Category:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.category}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>File Size:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.metadata.fileSize}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Rows:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.metadata.rows}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Columns:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.metadata.columns}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Format:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.metadata.format}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Upload Date:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(dataset.metadata.uploadDate).toLocaleDateString()}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Uploader:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.uploader.name} (${dataset.uploader.address})</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Public:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.metadata.isPublic ? 'Yes' : 'No'}</td></tr>
          </table>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px;">AI Analysis Summary</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; border-radius: 8px; text-align: center;">
              <h3 style="margin-bottom: 10px; font-size: 18px;">Quality Score</h3>
              <div style="font-size: 36px; font-weight: bold;">${dataset.results?.metrics?.quality_score || 0}%</div>
              <p style="font-size: 12px; opacity: 0.9;">Overall Data Quality</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 8px; text-align: center;">
              <h3 style="margin-bottom: 10px; font-size: 18px;">Completeness</h3>
              <div style="font-size: 36px; font-weight: bold;">${dataset.results?.metrics?.completeness || 0}%</div>
              <p style="font-size: 12px; opacity: 0.9;">Data Completeness</p>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${dataset.results?.metrics?.anomalies?.total || 0}</div>
              <p style="font-size: 12px; color: #6b7280;">Total Anomalies</p>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #ea580c;">${dataset.results?.metrics?.bias_metrics?.overall || 0}%</div>
              <p style="font-size: 12px; color: #6b7280;">Bias Score</p>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #059669;">${dataset.stats.views}</div>
              <p style="font-size: 12px; color: #6b7280;">Total Views</p>
            </div>
          </div>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px;">Detailed Metrics</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
              <h3 style="color: #1f2937; margin-bottom: 10px;">Quality Metrics</h3>
              <p><strong>Consistency:</strong> ${dataset.results?.metrics?.consistency || 0}%</p>
              <p><strong>Accuracy:</strong> ${dataset.results?.metrics?.accuracy || 0}%</p>
              <p><strong>Validity:</strong> ${dataset.results?.metrics?.validity || 0}%</p>
            </div>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
              <h3 style="color: #1f2937; margin-bottom: 10px;">Anomaly Breakdown</h3>
              <p><strong>High Priority:</strong> ${dataset.results?.metrics?.anomalies?.high || 0}</p>
              <p><strong>Medium Priority:</strong> ${dataset.results?.metrics?.anomalies?.medium || 0}</p>
              <p><strong>Low Priority:</strong> ${dataset.results?.metrics?.anomalies?.low || 0}</p>
            </div>
          </div>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px;">Key Insights</h2>
          ${(dataset.results?.insights || []).map((insight, index) => `
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6;">
              <h4 style="color: #1f2937; margin-bottom: 8px;">${insight.title}</h4>
              <p style="color: #4b5563; margin-bottom: 8px;">${insight.description}</p>
              <p style="color: #059669; font-style: italic;"><strong>Action:</strong> ${insight.action}</p>
            </div>
          `).join('')}
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px;">Blockchain Verification</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>IPFS Hash:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 10px;">${dataset.metadata.ipfsHash}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Contract Address:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 10px;">${dataset.metadata.contractAddress}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Block Number:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.metadata.blockNumber}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Views:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.stats.views}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Downloads:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.stats.downloads}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Citations:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${dataset.stats.citations}</td></tr>
          </table>
        </div>
        
        <div style="text-align: center; color: #6b7280; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p><strong>FileScope AI Complete Dataset Report</strong></p>
          <p>This report is cryptographically verified on the Filecoin blockchain</p>
          <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
      `;
      
      document.body.appendChild(pdfContent);
      
      // Convert to canvas and then to PDF
      const canvas = await html2canvas(pdfContent, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      document.body.removeChild(pdfContent);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`${dataset.title || 'dataset'}_complete_report.pdf`);
      
      toast.success('Complete dataset report downloaded as PDF!', { id: 'download' });
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('Failed to generate PDF report. Please try again.', { id: 'download' });
    }
  };

  // Don't render if wallet is not connected
  if (!mounted || !isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

  // Show loading state while fetching data
  if (loading || contractLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Database className="w-8 h-8 text-white animate-pulse" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Loading Datasets...</h1>
            <p className="text-gray-600 dark:text-gray-300">Fetching public datasets from blockchain...</p>
          </div>
        </div>
      </div>
    );
  }

  const categories = [
    { id: 'all', name: 'All Categories', count: datasets.length },
    { id: 'politics', name: 'Politics', count: 1 },
    { id: 'climate', name: 'Climate', count: 1 },
    { id: 'health', name: 'Health', count: 1 },
    { id: 'finance', name: 'Finance', count: 1 },
    { id: 'environment', name: 'Environment', count: 1 },
    { id: 'business', name: 'Business', count: 1 }
  ];

  // Filter and sort datasets
  const filteredDatasets = datasets
    .filter(dataset => {
      if (searchQuery && !dataset.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !dataset.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !dataset.metadata.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return false;
      }
      if (selectedCategory !== 'all' && dataset.category.toLowerCase() !== selectedCategory) {
        return false;
      }
      
      // Add null checking for metrics
      const qualityScore = dataset.results?.metrics?.quality_score || 0;
      if (qualityScore < filters.minQuality || qualityScore > filters.maxQuality) {
        return false;
      }
      
      if (filters.verified !== 'all' && 
          ((filters.verified === 'verified' && !dataset.analysis.verified) ||
           (filters.verified === 'unverified' && dataset.analysis.verified))) {
        return false;
      }
      if (filters.fileType !== 'all' && dataset.metadata.format?.toLowerCase() !== filters.fileType) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'quality':
          const aScore = a.results?.metrics?.quality_score || 0;
          const bScore = b.results?.metrics?.quality_score || 0;
          return bScore - aScore;
        case 'popular':
          return b.stats.views - a.stats.views;
        case 'downloads':
          return b.stats.downloads - a.stats.downloads;
        default:
          return new Date(b.metadata.uploadDate).getTime() - new Date(a.metadata.uploadDate).getTime();
      }
    });

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const DatasetCard = ({ dataset }: { dataset: Dataset }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {dataset.category}
            </span>
            {dataset.analysis.verified && (
              <Verified className="w-4 h-4 text-green-600" />
            )}
            {!isRealData(dataset) && (
              <span className="text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded">
                No Analysis Data
              </span>
            )}
          </div>
          <div className={`px-2 py-1 rounded text-xs font-medium ${getQualityColor(dataset.results?.metrics?.quality_score || 0)}`}>
            {dataset.results?.metrics?.quality_score > 0 ? `${dataset.results.metrics.quality_score}%` : 'N/A'}
          </div>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 leading-tight">
          {dataset.title}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4 line-clamp-2">
          {dataset.description}
        </p>

        {/* Stats */}
        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center space-x-1">
            <Database className="w-3 h-3" />
            <span>{formatNumber(dataset.metadata.rows)} rows</span>
          </div>
          <div className="flex items-center space-x-1">
            <FileText className="w-3 h-3" />
            <span>{dataset.metadata.format}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Eye className="w-3 h-3" />
            <span>{formatNumber(dataset.stats.views)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Download className="w-3 h-3" />
            <span>{formatNumber(dataset.stats.downloads)}</span>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {dataset.results?.metrics?.anomalies?.total > 0 ? dataset.results.metrics.anomalies.total : 'N/A'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Anomalies</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {dataset.results?.metrics?.bias_metrics?.overall > 0 ? `${(dataset.results.metrics.bias_metrics.overall * 100).toFixed(1)}%` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Overall Bias</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {dataset.results?.metrics?.completeness > 0 ? `${dataset.results.metrics.completeness}%` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Completeness</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
            <User className="w-3 h-3 text-white" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-900 dark:text-white">{dataset.uploader.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(dataset.metadata.uploadDate)}</div>
          </div>
        </div>
        
        <button 
          onClick={() => setSelectedDataset(dataset)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const DatasetListItem = ({ dataset }: { dataset: Dataset }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{dataset.title}</h3>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {dataset.category}
            </span>
            {dataset.analysis.verified && (
              <Verified className="w-4 h-4 text-green-600" />
            )}
            <div className={`px-2 py-1 rounded text-xs font-medium ${getQualityColor(dataset.results?.metrics?.quality_score || 0)}`}>
              {dataset.results?.metrics?.quality_score > 0 ? `${dataset.results.metrics.quality_score}%` : 'N/A'}
            </div>
          </div>
          
          <p className="text-gray-600 text-sm mb-4 leading-relaxed">
            {dataset.description}
          </p>

          <div className="flex items-center space-x-6 text-xs text-gray-500 mb-3">
            <div className="flex items-center space-x-1">
              <Database className="w-3 h-3" />
              <span>{formatNumber(dataset.metadata.rows)} rows • {dataset.metadata.columns} cols</span>
            </div>
            <div className="flex items-center space-x-1">
              <FileText className="w-3 h-3" />
              <span>{dataset.metadata.format} • {dataset.metadata.fileSize}</span>
            </div>
            <div className="flex items-center space-x-1">
              <User className="w-3 h-3" />
              <span>{dataset.uploader.name}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(dataset.metadata.uploadDate)}</span>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-xs text-gray-500">
            <span>{formatNumber(dataset.stats.views)} views</span>
            <span>{formatNumber(dataset.stats.downloads)} downloads</span>
            <span>{dataset.stats.citations} citations</span>
            <span>{dataset.results?.metrics?.anomalies?.total > 0 ? dataset.results.metrics.anomalies.total : 'N/A'} anomalies</span>
            <span>{dataset.results?.metrics?.bias_metrics?.overall > 0 ? `${(dataset.results.metrics.bias_metrics.overall * 100).toFixed(1)}%` : 'N/A'} bias</span>
          </div>
        </div>

        <div className="ml-6 flex flex-col space-y-2">
          <button 
            onClick={() => setSelectedDataset(dataset)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center space-x-2"
          >
            <Eye className="w-4 h-4" />
            <span>View Analysis</span>
          </button>
          <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:border-gray-400 transition-colors text-sm font-medium flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Helper function to detect category from dataset content
  const detectCategory = (title: string, description: string, tags: string[] = []): string => {
    const text = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
    
    // Define category keywords
    const categories = {
      'Finance': ['finance', 'financial', 'money', 'currency', 'crypto', 'bitcoin', 'ethereum', 'trading', 'stock', 'market', 'investment', 'banking', 'revenue', 'profit', 'loss', 'price', 'economic'],
      'Health': ['health', 'medical', 'covid', 'disease', 'patient', 'hospital', 'doctor', 'treatment', 'medicine', 'vaccine', 'symptom', 'diagnosis', 'clinical', 'biomedical', 'pharmaceutical'],
      'Climate': ['climate', 'weather', 'temperature', 'environment', 'pollution', 'emission', 'carbon', 'global warming', 'sustainability', 'renewable', 'energy', 'atmospheric', 'meteorological'],
      'Politics': ['politics', 'political', 'election', 'vote', 'candidate', 'party', 'government', 'policy', 'democratic', 'republican', 'poll', 'campaign', 'legislation', 'congress', 'senate'],
      'Business': ['business', 'company', 'corporate', 'enterprise', 'startup', 'revenue', 'sales', 'customer', 'product', 'service', 'market', 'industry', 'commercial', 'retail', 'ecommerce'],
      'Technology': ['technology', 'tech', 'software', 'hardware', 'computer', 'digital', 'internet', 'web', 'mobile', 'app', 'algorithm', 'artificial intelligence', 'machine learning', 'data science'],
      'Education': ['education', 'school', 'university', 'student', 'academic', 'learning', 'course', 'grade', 'test', 'exam', 'curriculum', 'teaching', 'research', 'scholarly'],
      'Social': ['social', 'society', 'community', 'population', 'demographic', 'survey', 'opinion', 'behavior', 'culture', 'social media', 'network', 'relationship', 'family', 'marriage'],
      'Sports': ['sports', 'athletic', 'game', 'team', 'player', 'score', 'match', 'tournament', 'league', 'fitness', 'exercise', 'olympic', 'football', 'basketball', 'soccer'],
      'Transportation': ['transport', 'transportation', 'vehicle', 'car', 'traffic', 'road', 'highway', 'public transit', 'bus', 'train', 'airplane', 'logistics', 'shipping', 'delivery']
    };
    
    // Find the best matching category
    let bestCategory = 'Uncategorized';
    let bestScore = 0;
    
    for (const [category, keywords] of Object.entries(categories)) {
      const score = keywords.filter(keyword => text.includes(keyword)).length;
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }
    
    return bestCategory;
  };

  // Helper function to check if data is real or fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isRealData = (data: any): boolean => {
    // Check if we have actual analysis results vs fallback values
    if (!data || typeof data !== 'object') return false;
    
    // Check for real analysis indicators
    const hasRealAnalysis = data.results?.metrics?.quality_score > 0 ||
                           data.results?.metrics?.completeness > 0 ||
                           data.results?.metrics?.consistency > 0 ||
                           data.results?.metrics?.accuracy > 0 ||
                           data.results?.metrics?.validity > 0 ||
                           data.results?.metrics?.anomalies?.total > 0 ||
                           data.results?.metrics?.bias_metrics?.overall > 0 ||
                           (data.results?.insights && data.results.insights.length > 0);
    
    return hasRealAnalysis;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
                <Link href="/" className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dataset Explorer</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Browse and discover verified datasets</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                  <Verified className="w-4 h-4 text-green-600" />
                  <span>Blockchain Verified</span>
                </div>
            </div>
          </div>
        </div>
      </div>

        {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search and Filters */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* Search Bar */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search datasets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* View Toggle and Sort */}
              <div className="flex items-center space-x-4">
                {/* View Mode Toggle */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'grid' 
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 pr-8 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="quality">Highest Quality</option>
                    <option value="popular">Most Popular</option>
                    <option value="downloads">Most Downloaded</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-lg border transition-colors ${
                    showFilters 
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' 
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-spin">
                <Database className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Loading Datasets...</h2>
              <p className="text-gray-600 dark:text-gray-300">Fetching public datasets from the API.</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Error Loading Datasets</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Database className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No Public Datasets Available</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                No public datasets have been uploaded yet. Be the first to share your analysis!
              </p>
              <Link 
                href="/upload"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload Your First Dataset
              </Link>
            </div>
          ) : (
            <>
              {/* Results Summary */}
              <div className="mb-6">
                <p className="text-gray-600 dark:text-gray-400">
                  Showing {filteredDatasets.length} of {datasets.length} datasets
                </p>
              </div>

              {/* Dataset Grid/List */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredDatasets.map((dataset) => (
                    <DatasetCard key={dataset.id} dataset={dataset} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDatasets.map((dataset) => (
                    <DatasetListItem key={dataset.id} dataset={dataset} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

          {/* Filters Sidebar */}
        {showFilters && (
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Filters</h3>
              
              {/* Categories */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Categories</h4>
                <div className="space-y-2">
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{category.name}</span>
                        <span className="text-xs">{category.count}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Score Range */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Quality Score</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">Minimum</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.minQuality}
                      onChange={(e) => setFilters({...filters, minQuality: parseInt(e.target.value)})}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-600">{filters.minQuality}%</div>
                  </div>
                </div>
              </div>

              {/* Verification Status */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Verification</h4>
                <div className="space-y-2">
                  {[
                    { id: 'all', name: 'All Datasets' },
                    { id: 'verified', name: 'Verified Only' },
                    { id: 'unverified', name: 'Unverified' }
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setFilters({...filters, verified: option.id})}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        filters.verified === option.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* File Type */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">File Type</h4>
                <div className="space-y-2">
                  {[
                    { id: 'all', name: 'All Types' },
                    { id: 'csv', name: 'CSV' },
                    { id: 'json', name: 'JSON' },
                    { id: 'xlsx', name: 'Excel' }
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setFilters({...filters, fileType: option.id})}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        filters.fileType === option.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
              </div>
            )}

      {/* Dataset Detail Modal */}
      {selectedDataset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedDataset.title}</h2>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded">
                      {selectedDataset.category}
                    </span>
                    {selectedDataset.analysis.verified && (
                      <div className="flex items-center space-x-1 text-green-600">
                        <Verified className="w-4 h-4" />
                        <span className="text-sm font-medium">Verified</span>
                      </div>
                    )}
                    <div className={`px-3 py-1 rounded text-sm font-medium ${getQualityColor(selectedDataset.results?.metrics?.quality_score || 0)}`}>
                      Quality: {selectedDataset.results?.metrics?.quality_score || 0}%
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDataset(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-8">
              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <p className="text-gray-600 leading-relaxed">{selectedDataset.description}</p>
              </div>

              {/* Metadata Grid */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Dataset Information</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">File Size:</span>
                      <span className="font-bold text-gray-900 dark:text-white text-base">{selectedDataset.metadata.fileSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rows:</span>
                      <span className="font-bold text-gray-900 dark:text-white text-base">{formatNumber(selectedDataset.metadata.rows)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Columns:</span>
                      <span className="font-bold text-gray-900 dark:text-white text-base">{selectedDataset.metadata.columns}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Format:</span>
                      <span className="font-bold text-gray-900 dark:text-white text-base">{selectedDataset.metadata.format}</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Views:</span>
                      <span className="font-bold text-gray-900 dark:text-white text-base">{formatNumber(selectedDataset.stats.views)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Downloads:</span>
                      <span className="font-bold text-gray-900 dark:text-white text-base">{formatNumber(selectedDataset.stats.downloads)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Citations:</span>
                      <span className="font-bold text-gray-900 dark:text-white text-base">{selectedDataset.stats.citations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Upload Date:</span>
                      <span className="font-bold text-gray-900 dark:text-white text-base">{formatDate(selectedDataset.metadata.uploadDate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analysis Results */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Analysis Results</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">{selectedDataset.results?.metrics?.quality_score || 0}%</div>
                    <div className="text-sm text-gray-600">Quality Score</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">{selectedDataset.results?.metrics?.anomalies?.total || 0}</div>
                    <div className="text-sm text-gray-600">Anomalies</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">{selectedDataset.results?.metrics?.bias_metrics?.overall || 0}%</div>
                    <div className="text-sm text-gray-600">Bias Score</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">{selectedDataset.results?.metrics?.completeness || 0}%</div>
                    <div className="text-sm text-gray-600">Completeness</div>
                  </div>
                </div>
              </div>

              {/* Blockchain Verification */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Blockchain Verification</h3>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-3 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">Analysis Verified on Filecoin</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-green-700">IPFS Hash:</span>
                      <code className="text-sm bg-white px-2 py-1 rounded font-mono">
                        {selectedDataset.metadata.ipfsHash}
                      </code>
                      <button className="text-green-600 hover:text-green-700">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Debug Information (only show in development) */}
              {process.env.NODE_ENV === 'development' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Debug Information</h3>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="text-sm text-gray-600 space-y-2">
                      <div><strong>Quality Score:</strong> {selectedDataset.results?.metrics?.quality_score || 'undefined'}</div>
                      <div><strong>Completeness:</strong> {selectedDataset.results?.metrics?.completeness || 'undefined'}</div>
                      <div><strong>Anomalies Total:</strong> {selectedDataset.results?.metrics?.anomalies?.total || 'undefined'}</div>
                      <div><strong>Bias Overall:</strong> {selectedDataset.results?.metrics?.bias_metrics?.overall || 'undefined'}</div>
                      <div><strong>Insights Count:</strong> {selectedDataset.results?.insights?.length || 'undefined'}</div>
                      <div><strong>File Size:</strong> {selectedDataset.metadata.fileSize}</div>
                      <div><strong>Rows:</strong> {selectedDataset.metadata.rows}</div>
                      <div><strong>Columns:</strong> {selectedDataset.metadata.columns}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedDataset.metadata.tags?.map((tag, index) => (
                    <span key={index} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Uploader Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Uploaded By</h3>
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{selectedDataset.uploader.name}</span>
                      {selectedDataset.uploader.verified && (
                        <Verified className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Reputation: {selectedDataset.uploader.reputation}/100
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedDataset.uploader.address}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 rounded-b-2xl">
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Download Options:</h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <p><strong>Download Original File:</strong> Get the actual original dataset file (CSV, JSON, Excel, etc.) as uploaded by the user</p>
                  <p><strong>Download Analysis (PDF):</strong> Get a detailed AI analysis report in PDF format</p>
                  <p><strong>Complete Report (PDF):</strong> Get everything - dataset info, analysis, and blockchain verification</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                <div className="text-sm text-gray-600">
                  Last updated {formatDate(selectedDataset.metadata.uploadDate)}
                </div>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                  <button 
                    onClick={() => downloadOriginalDataset(selectedDataset)}
                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:border-gray-400 transition-colors flex items-center space-x-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Original File</span>
                  </button>
                  <button 
                    onClick={() => downloadAnalysisResults(selectedDataset)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 text-sm"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Download Analysis (PDF)</span>
                  </button>
                  <button 
                    onClick={() => downloadCompleteDataset(selectedDataset)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Complete Report (PDF)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatasetExplorer;