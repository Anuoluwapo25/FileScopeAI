'use client'
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { 
  Upload, FileText, Database, CheckCircle, AlertCircle, 
  X, ArrowRight, BarChart3, Shield, Zap, 
  FileSpreadsheet, Code, Info, Loader, Eye
} from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { analysisAPI } from '../../services/analysisApi';
import { fileStoreContract } from '../index';

// Pinata IPFS configuration
const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY;
const PINATA_JWT_SECRET = process.env.NEXT_PUBLIC_JWT_SECRET;

interface FilePreview {
  headers: string[];
  sampleRows: string[][];
  totalLines: number;
}

interface SupportedType {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}

interface SampleDataset {
  name: string;
  size: string;
  rows: string;
  description: string;
  type: string;
}

const FileScopeApp = () => {
  // Navigation state
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'processing'>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Upload states
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Real AI Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<number | null>(null);
  
  // Results states  
  const [isPublic, setIsPublic] = useState(false);

  // New state for tracking analysis data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [ipfsHash, setIpfsHash] = useState<string | null>(null);

  // Wallet connection check
  const { isConnected } = useAccount();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Blockchain contract write hook
  const { writeContract, data: blockchainData, isPending: isBlockchainLoading, error: contractError, reset: resetContract } = useWriteContract();

  // Transaction receipt hook for confirmation
  const { data: transactionReceipt, isSuccess: isTransactionConfirmed, error: receiptError } = useWaitForTransactionReceipt({
    hash: blockchainData as `0x${string}` | undefined,
  });

  // All memoized values MUST be called before any conditional logic
  // Supported file types
  const supportedTypes: Record<string, SupportedType> = useMemo(() => ({
    'text/csv': { icon: FileSpreadsheet, label: 'CSV', color: 'green' },
    'application/json': { icon: Code, label: 'JSON', color: 'blue' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: FileText, label: 'XLSX', color: 'orange' }
  }), []);

  // Sample datasets
  const sampleDatasets: SampleDataset[] = useMemo(() => [
    {
      name: "Election Polling Data 2024",
      size: "2.3 MB",
      rows: "15,420",
      description: "Comprehensive polling data from multiple sources",
      type: "CSV"
    },
    {
      name: "Climate Temperature Records",
      size: "8.7 MB", 
      rows: "89,432",
      description: "Global temperature data over the past 50 years",
      type: "JSON"
    }
  ], []);

  // ALL useCallback functions MUST be called before any conditional logic
  // Function to clear saved state
  const clearSavedState = useCallback(() => {
    sessionStorage.removeItem('uploadState');
    console.log('🗑️ Cleared saved state');
  }, []);

  // Function to save current state to sessionStorage
  const saveState = useCallback(() => {
    const state = {
      currentStep,
      analysisProgress,
      currentAnalysisId,
      fileName: uploadedFile?.name,
      fileSize: uploadedFile?.size,
      fileType: uploadedFile?.type,
      isPublic
    };
    sessionStorage.setItem('uploadState', JSON.stringify(state));
    console.log('💾 Saved state to sessionStorage:', state);
  }, [currentStep, analysisProgress, currentAnalysisId, uploadedFile, isPublic]);

  // IPFS Upload Function using Pinata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadToIPFS = useCallback(async (file: File, analysisResults: any) => {
    try {
      console.log('🌐 Starting IPFS upload...');
      
      // Create metadata for IPFS
      const metadata = {
        name: file.name,
        description: `AI Analysis Results for ${file.name}`,
        image: null,
        attributes: [
          {
            trait_type: "File Type",
            value: file.type
          },
          {
            trait_type: "File Size",
            value: `${(file.size / 1024).toFixed(2)} KB`
          },
          {
            trait_type: "Quality Score",
            value: analysisResults.qualityScore?.overall || 0
          },
          {
            trait_type: "Anomalies Found",
            value: analysisResults.anomalies?.total || 0
          },
          {
            trait_type: "Analysis Date",
            value: new Date().toISOString()
          }
        ]
      };

      // Upload metadata to IPFS
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });

      const formData = new FormData();
      formData.append('file', metadataFile);

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PINATA_JWT_SECRET}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`IPFS upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      const hash = result.IpfsHash;
      
      console.log('✅ IPFS upload successful:', hash);
      return hash;
    } catch (error) {
      console.error('❌ IPFS upload failed:', error);
      throw new Error(`Failed to upload to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Navigation Functions
  const navigateToStep = useCallback((step: 'upload' | 'preview' | 'processing') => {
    setCurrentStep(step);
    if (step === 'upload') {
      // Inline reset logic to avoid dependency issues
      setUploadedFile(null);
      setFilePreview(null);
      setError(null);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setCurrentAnalysisId(null);
      setIsPublic(false);
      setAnalysisResults(null);
      setIpfsHash(null);
      resetContract();
    }
  }, [resetContract]);

  const resetUpload = useCallback(() => {
    setUploadedFile(null);
    setFilePreview(null);
    setError(null);
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setCurrentAnalysisId(null);
    setIsPublic(false);
    setAnalysisResults(null);
    setIpfsHash(null);
    resetContract();
  }, [resetContract]);

  // File Upload Functions
  const generatePreview = useCallback((file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      let preview: FilePreview = { headers: [], sampleRows: [], totalLines: 0 };
      
      if (file.type === 'text/csv') {
        const lines = content.split('\n');
        preview = {
          headers: lines[0] ? lines[0].split(',').map((h: string) => h.trim()) : [],
          sampleRows: lines.slice(1, 6).map((row: string) => row.split(',')),
          totalLines: lines.length - 1
        };
      }
      
      setFilePreview(preview);
    };
    
    reader.readAsText(file);
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    setError(null);
    
    if (!supportedTypes[file.type]) {
      const errorMsg = `Unsupported file type: ${file.type}. Please upload CSV, JSON, or Excel files.`;
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      const errorMsg = 'File size too large. Please upload files smaller than 100MB.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setUploadedFile(file);
    generatePreview(file);
    setCurrentStep('preview');
    toast.success('File uploaded successfully! Review your data below.');
  }, [supportedTypes, generatePreview]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, [handleFileUpload]);

  const handleSampleDataset = useCallback((dataset: SampleDataset) => {
    const csvContent = `poll_date,candidate,party,percentage,sample_size,location
2024-07-15,John Smith,Democratic,42.3,1200,California
2024-07-15,Jane Doe,Republican,38.7,1200,California
2024-07-16,John Smith,Democratic,41.8,950,Texas
2024-07-16,Jane Doe,Republican,39.2,950,Texas
2024-07-17,John Smith,Democratic,43.1,1100,New York
2024-07-17,Jane Doe,Republican,37.9,1100,New York`;
    
    const mockFile = new File(
      [csvContent], 
      dataset.name.toLowerCase().replace(/\s+/g, '_') + '.csv',
      { type: 'text/csv' }
    );
    setUploadedFile(mockFile);
    
    setFilePreview({
      headers: ['poll_date', 'candidate', 'party', 'percentage', 'sample_size', 'location'],
      sampleRows: [
        ['2024-07-15', 'John Smith', 'Democratic', '42.3', '1200', 'California'],
        ['2024-07-15', 'Jane Doe', 'Republican', '38.7', '1200', 'California'],
        ['2024-07-16', 'John Smith', 'Democratic', '41.8', '950', 'Texas'],
        ['2024-07-16', 'Jane Doe', 'Republican', '39.2', '950', 'Texas']
      ],
      totalLines: parseInt(dataset.rows.replace(',', ''))
    });
    
    setCurrentStep('preview');
    toast.success(`Using sample dataset: ${dataset.name}`);
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!uploadedFile) {
      toast.error('No file selected');
      return;
    }

    // Reset previous state
    setAnalysisResults(null);
    setIpfsHash(null);
    resetContract();
    
    setCurrentStep('processing');
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    // Save state before starting analysis
    saveState();
    
    try {
      // Step 1: Upload file and start real AI analysis
      toast.loading('Uploading file and starting AI analysis...', { id: 'analysis' });
      
      const uploadResult = await analysisAPI.uploadAndAnalyze(uploadedFile, isPublic);
      const analysisId = uploadResult.analysis_id;
      setCurrentAnalysisId(typeof analysisId === 'string' ? parseInt(analysisId) : analysisId);
      
      toast.success(`Analysis started! ID: ${analysisId}`, { id: 'analysis' });
      
      // Continue with monitoring
      await continueAnalysisMonitoring(String(analysisId));
      
    } catch (error) {
      console.error('Analysis failed:', error);
      let errorMessage = 'Analysis failed. Please try again.';
      
      if (error instanceof Error) {
        console.log('🔍 Detailed error information:');
        console.log('- Error name:', error.name);
        console.log('- Error message:', error.message);
        console.log('- Error stack:', error.stack);
        
        if (error.message.includes('No file provided')) {
          errorMessage = 'Please select a valid file to analyze.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Analysis is taking longer than expected. Please check back later.';
        } else if (error.message.includes('IPFS')) {
          errorMessage = 'Failed to store results on IPFS. Please try again.';
        } else if (error.message.includes('Blockchain') || error.message.includes('Contract')) {
          errorMessage = 'Blockchain registration failed. Please check your wallet and try again.';
        } else if (error.message.includes('failed')) {
          const match = error.message.match(/Upload failed \((\d+)\): (.+)/);
          if (match) {
            const statusCode = match[1];
            const serverError = match[2];
            errorMessage = `Server error (${statusCode}): ${serverError}`;
          } else {
            errorMessage = `Server error: ${error.message}`;
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage, { id: 'analysis' });
      setCurrentStep('preview');
      setIsAnalyzing(false);
      clearSavedState(); // Clear saved state on error
    }
  }, [uploadedFile, isPublic, saveState, clearSavedState, resetContract]);

  // Function to continue monitoring analysis (used for both new and restored sessions)
  const continueAnalysisMonitoring = useCallback(async (analysisId: string) => {
    try {
      // Step 2: Wait for analysis completion with real progress updates
      toast.loading('AI analysis in progress...', { id: 'analysis' });
      
      const completedAnalysis = await analysisAPI.waitForAnalysisCompletion(
        analysisId,
        (status, progress) => {
          setAnalysisProgress(progress || 0);
          if (status === 'processing') {
            toast.loading(`AI analysis in progress... ${Math.round(progress || 0)}%`, { id: 'analysis' });
          } else if (status === 'pending') {
            toast.loading('Analysis queued...', { id: 'analysis' });
          }
        }
      );
      
      // Step 3: Convert backend format to frontend format
      const frontendResults = analysisAPI.convertToFrontendFormat(completedAnalysis);
      setAnalysisResults(frontendResults); // Store results in state
      
      // Step 4: Upload to IPFS
      toast.loading('Storing results on IPFS...', { id: 'analysis' });
      setAnalysisProgress(85);
      saveState(); // Save state before IPFS upload
      
      const hash = await uploadToIPFS(uploadedFile!, frontendResults);
      setIpfsHash(hash); // Store IPFS hash in state
      
      // Step 5: Register on Blockchain
      toast.loading('Registering on blockchain...', { id: 'analysis' });
      setAnalysisProgress(95);
      saveState(); // Save state before blockchain interaction
      
      if (!writeContract) {
        throw new Error('Blockchain upload function not available');
      }
      
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      console.log('🔗 Calling smart contract...');
      console.log('Contract address:', fileStoreContract.address);
      console.log('IPFS hash:', hash);
      console.log('Is public:', isPublic);
      
      // Call the smart contract
      writeContract({
        address: fileStoreContract.address as `0x${string}`,
        abi: fileStoreContract.abi,
        functionName: 'uploadDataset',
        args: [hash, hash, isPublic], // datasetCID, analysisCID, isPublic
      });
      
      console.log('✅ Smart contract call initiated...');
      toast.loading('Waiting for wallet confirmation...', { id: 'analysis' });
      
      // The useEffect hook will handle navigation when transaction is confirmed
      
    } catch (error) {
      console.error('Analysis monitoring failed:', error);
      toast.error('Analysis monitoring failed. Please try again.', { id: 'analysis' });
      setCurrentStep('preview');
      setIsAnalyzing(false);
      clearSavedState();
    }
  }, [uploadedFile, isPublic, uploadToIPFS, writeContract, isConnected, saveState, clearSavedState]);

  // ALL useEffect hooks MUST be called before any conditional logic
  // Set mounted state after component mounts
  useEffect(() => {
    setMounted(true);
    
    // Restore state from sessionStorage if available
    const savedState = sessionStorage.getItem('uploadState');
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        if (parsedState.currentStep === 'processing') {
          console.log('🔄 Found processing state, attempting to restore...');
          
          // Check if we have analysis results already stored
          const existingResults = sessionStorage.getItem('analysisResults');
          if (existingResults) {
            console.log('✅ Found existing results, navigating to results page');
            clearSavedState();
            router.push('/results');
            return;
          }
          
          // If no results but we have an analysis ID, we might be able to check status
          if (parsedState.currentAnalysisId) {
            console.log('🔍 Checking analysis status for ID:', parsedState.currentAnalysisId);
            
            // Check if analysis is complete
            analysisAPI.getAnalysisStatus(String(parsedState.currentAnalysisId))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .then((status: any) => {
                console.log('📊 Analysis status:', status);
                
                if (status.status === 'completed') {
                  console.log('🎉 Analysis already completed, processing results...');
                  const frontendResults = analysisAPI.convertToFrontendFormat(status);
                  
                  // Create mock file for results page
                  const mockFile = new File([''], parsedState.fileName || 'unknown.csv', {
                    type: parsedState.fileType || 'text/csv'
                  });
                  
                  // Store results and navigate
                  const resultsData = {
                    results: frontendResults,
                    fileName: mockFile.name,
                    fileSize: parsedState.fileSize || 0,
                    analysisId: parsedState.currentAnalysisId,
                    timestamp: new Date().toISOString(),
                    isPublic: parsedState.isPublic || false,
                    ipfsHash: 'restored-' + Date.now(), // Placeholder
                    blockchainData: {
                      transactionHash: 'restored',
                      blockNumber: 'restored',
                      gasUsed: 'N/A',
                      status: 'restored'
                    }
                  };
                  
                  sessionStorage.setItem('analysisResults', JSON.stringify(resultsData));
                  clearSavedState();
                  router.push('/results');
                } else if (status.status === 'failed' || status.status === 'error') {
                  console.log('❌ Analysis failed, clearing state');
                  toast.error('Previous analysis failed. Please try again.');
                  clearSavedState();
                  setCurrentStep('upload');
                } else {
                  console.log('⏳ Analysis still in progress, restoring UI state');
                  // Restore the UI state for ongoing analysis
                  setCurrentStep('processing');
                  setAnalysisProgress(parsedState.analysisProgress || 0);
                  setCurrentAnalysisId(parsedState.currentAnalysisId);
                  setIsAnalyzing(true);
                  
                  // Restore file data if available
                  if (parsedState.fileName) {
                    const mockFile = new File([''], parsedState.fileName, { 
                      type: parsedState.fileType || 'text/csv',
                      lastModified: Date.now()
                    });
                    setUploadedFile(mockFile);
                  }
                  
                  // Continue monitoring the analysis
                  continueAnalysisMonitoring(String(parsedState.currentAnalysisId));
                }
              })
              .catch(error => {
                console.error('❌ Failed to check analysis status:', error);
                toast.error('Failed to restore previous session. Starting fresh.');
                clearSavedState();
                setCurrentStep('upload');
              });
          } else {
            console.log('⚠️ No analysis ID found, clearing corrupted state');
            toast.error('Previous session corrupted. Starting fresh.');
            clearSavedState();
            setCurrentStep('upload');
          }
        } else {
          console.log('📝 Restored non-processing state');
          // Restore other states normally
          setCurrentStep(parsedState.currentStep || 'upload');
          setAnalysisProgress(parsedState.analysisProgress || 0);
          setCurrentAnalysisId(parsedState.currentAnalysisId);
          setIsAnalyzing(false);
          
          if (parsedState.fileName && parsedState.fileSize) {
            const mockFile = new File([''], parsedState.fileName, { 
              type: parsedState.fileType || 'text/csv',
              lastModified: Date.now()
            });
            setUploadedFile(mockFile);
          }
        }
      } catch (error) {
        console.error('❌ Failed to restore state:', error);
        sessionStorage.removeItem('uploadState');
        toast.error('Failed to restore previous session.');
      }
    }
  }, [router, clearSavedState]);

  // Check wallet connection on mount
  useEffect(() => {
    if (mounted && !isConnected) {
      toast.error('Please connect your wallet to use this feature', {
        duration: 4000,
        icon: '🔒',
      });
      router.push('/');
    }
  }, [isConnected, router, mounted]);

  // Watch for transaction confirmation and navigate to results
  useEffect(() => {
    if (mounted && isTransactionConfirmed && transactionReceipt && analysisResults && ipfsHash && uploadedFile) {
      console.log('✅ Transaction confirmed! Preparing navigation to results...');
      
      // Store results in sessionStorage for the results page
      const resultsData = {
        results: analysisResults,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        analysisId: currentAnalysisId,
        timestamp: new Date().toISOString(),
        isPublic: isPublic,
        ipfsHash: ipfsHash,
        blockchainData: {
          transactionHash: blockchainData,
          blockNumber: transactionReceipt.blockNumber?.toString() || 'confirmed',
          gasUsed: transactionReceipt.gasUsed?.toString() || 'N/A',
          status: 'confirmed'
        }
      };
      
      sessionStorage.setItem('analysisResults', JSON.stringify(resultsData));
      
      // Update progress to 100%
      setAnalysisProgress(100);
      
      const visibilityMsg = isPublic 
        ? 'Analysis completed and confirmed on blockchain! 🌐' 
        : 'Analysis completed and confirmed on blockchain! 🔒';
      toast.success(visibilityMsg, { id: 'analysis' });
      
      // Clear saved processing state
      clearSavedState();
      
      // Navigate to results page after a short delay to show completion
      setTimeout(() => {
        console.log('🚀 Navigating to results page...');
        router.push('/results');
      }, 1000);
    }
  }, [mounted, isTransactionConfirmed, transactionReceipt, analysisResults, ipfsHash, uploadedFile, currentAnalysisId, isPublic, blockchainData, router, clearSavedState]);

  // Watch for contract errors
  useEffect(() => {
    if (mounted && contractError) {
      console.error('Contract error:', contractError);
      toast.error(`Contract error: ${contractError.message}`, { id: 'analysis' });
      setIsAnalyzing(false);
      setCurrentStep('preview');
      clearSavedState();
    }
  }, [mounted, contractError, clearSavedState]);

  // Watch for receipt errors
  useEffect(() => {
    if (mounted && receiptError) {
      console.error('Receipt error:', receiptError);
      toast.error(`Transaction error: ${receiptError.message}`, { id: 'analysis' });
      setIsAnalyzing(false);
      setCurrentStep('preview');
      clearSavedState();
    }
  }, [mounted, receiptError, clearSavedState]);

  // Save state whenever progress changes during processing
  useEffect(() => {
    if (currentStep === 'processing' && isAnalyzing) {
      saveState();
    }
  }, [currentStep, analysisProgress, currentAnalysisId, isAnalyzing, saveState]);

  // Conditional rendering - but AFTER all hooks have been called
  const shouldShowContent = mounted && isConnected;

  // Render loading state while checking wallet connection
  if (!shouldShowContent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {!mounted ? 'Loading...' : 'Connecting Wallet...'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {!mounted 
                ? 'Please wait while we initialize the application.' 
                : 'Please connect your wallet to continue.'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render different steps based on current state
  const renderContent = () => {
    if (currentStep === 'processing') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Database className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Analyzing Your Dataset</h1>
              <p className="text-gray-600 dark:text-gray-300">Our AI is processing your data with advanced algorithms</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-gray-700">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-6 relative">
                  <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
                  <BarChart3 className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Processing {uploadedFile?.name}</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-8">Running comprehensive AI analysis...</p>
                
                {/* Real Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                    style={{width: `${analysisProgress}%`}}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.round(analysisProgress)}% complete
                  {currentAnalysisId && (
                    <span className="block mt-1 text-xs">
                      Analysis ID: {currentAnalysisId}
                    </span>
                  )}
                  {blockchainData && (
                    <span className="block mt-1 text-xs">
                      Transaction: {blockchainData.slice(0, 10)}...
                    </span>
                  )}
                </p>
              </div>

              {/* Real Analysis Steps */}
              <div className="space-y-4 mb-8">
                {/* File Upload & Validation */}
                <div className={`flex items-center space-x-4 p-4 rounded-lg border ${
                  analysisProgress > 0 
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
                    : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
                }`}>
                  {analysisProgress > 0 ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : (
                    <Loader className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin" />
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${
                      analysisProgress > 0 ? 'text-green-900 dark:text-green-100' : 'text-blue-900 dark:text-blue-100'
                    }`}>
                      File Upload & Validation
                    </div>
                    <div className={`text-sm ${
                      analysisProgress > 0 ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'
                    }`}>
                      {analysisProgress > 0 ? 'Dataset uploaded successfully' : 'Uploading to AI analysis server...'}
                    </div>
                  </div>
                </div>

                {/* AI Analysis */}
                <div className={`flex items-center space-x-4 p-4 rounded-lg border ${
                  analysisProgress > 30 
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
                    : analysisProgress > 10
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  {analysisProgress > 30 ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : analysisProgress > 10 ? (
                    <Loader className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0"></div>
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${
                      analysisProgress > 30 ? 'text-green-900 dark:text-green-100' : 
                      analysisProgress > 10 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      AI Analysis
                    </div>
                    <div className={`text-sm ${
                      analysisProgress > 30 ? 'text-green-700 dark:text-green-300' : 
                      analysisProgress > 10 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {analysisProgress > 30 ? 'Quality metrics and anomalies detected' : 
                       analysisProgress > 10 ? 'Running comprehensive AI analysis...' : 
                       'Pending AI analysis'}
                    </div>
                  </div>
                </div>

                {/* IPFS Storage */}
                <div className={`flex items-center space-x-4 p-4 rounded-lg border ${
                  analysisProgress > 85 
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
                    : analysisProgress > 80
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  {analysisProgress > 85 ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : analysisProgress > 80 ? (
                    <Loader className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0"></div>
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${
                      analysisProgress > 85 ? 'text-green-900 dark:text-green-100' : 
                      analysisProgress > 80 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      IPFS Storage
                    </div>
                    <div className={`text-sm ${
                      analysisProgress > 85 ? 'text-green-700 dark:text-green-300' : 
                      analysisProgress > 80 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {analysisProgress > 85 ? 'Results stored on IPFS' : 
                       analysisProgress > 80 ? 'Uploading to decentralized storage...' : 
                       'Pending IPFS storage'}
                    </div>
                  </div>
                </div>

                {/* Blockchain Registration */}
                <div className={`flex items-center space-x-4 p-4 rounded-lg border ${
                  analysisProgress >= 100 
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
                    : analysisProgress > 95
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  {analysisProgress >= 100 ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : analysisProgress > 95 ? (
                    <Loader className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0"></div>
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${
                      analysisProgress >= 100 ? 'text-green-900 dark:text-green-100' : 
                      analysisProgress > 95 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      Blockchain Registration
                    </div>
                    <div className={`text-sm ${
                      analysisProgress >= 100 ? 'text-green-700 dark:text-green-300' : 
                      analysisProgress > 95 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {analysisProgress >= 100 ? 'Dataset registered on blockchain' : 
                       analysisProgress > 95 ? 'Registering on Filecoin blockchain...' : 
                       'Pending blockchain registration'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time file info */}
              {uploadedFile && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatFileSize(uploadedFile.size)}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">File Size</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{filePreview?.totalLines?.toLocaleString() || '0'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Rows</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{filePreview?.headers?.length || '0'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Columns</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{supportedTypes[uploadedFile.type]?.label || 'Unknown'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Format</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Emergency Navigation & Recovery Buttons */}
              <div className="mt-6 space-y-4">
                {/* Show transaction status if we have blockchain data */}
                {analysisProgress > 95 && blockchainData && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-center">
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                        Transaction submitted: {blockchainData.slice(0, 10)}...
                        {isTransactionConfirmed ? ' ✅ Confirmed!' : ' ⏳ Confirming...'}
                      </p>
                      {!isTransactionConfirmed && (
                        <button
                          onClick={() => {
                            clearSavedState();
                            router.push('/results');
                          }}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Continue to Results (if stuck)
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Recovery options for stuck processing */}
                {isAnalyzing && analysisProgress < 95 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="text-center">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                        Analysis taking too long? 
                        {currentAnalysisId && (
                          <span className="block text-xs mt-1">
                            Analysis ID: {currentAnalysisId}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        {currentAnalysisId && (
                          <button
                            onClick={() => continueAnalysisMonitoring(String(currentAnalysisId))}
                            className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                          >
                            Retry Analysis Check
                          </button>
                        )}
                        <button
                          onClick={() => {
                            clearSavedState();
                            setCurrentStep('upload');
                            setIsAnalyzing(false);
                            setAnalysisProgress(0);
                            setCurrentAnalysisId(null);
                            toast.success('Restarted session. Please upload your file again.');
                          }}
                          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                        >
                          Start Over
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 'preview') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Database className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Review & Analyze</h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Review your data preview and start the AI analysis process
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* File Header */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      {uploadedFile?.type && supportedTypes[uploadedFile.type] && (() => {
                        const IconComponent = supportedTypes[uploadedFile.type].icon;
                        return <IconComponent className="w-6 h-6 text-white" />;
                      })()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{uploadedFile?.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatFileSize(uploadedFile?.size || 0)}</span>
                        <span>•</span>
                        <span>{filePreview?.totalLines?.toLocaleString()} rows</span>
                        <span>•</span>
                        <span>{filePreview?.headers?.length} columns</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigateToStep('upload')} 
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Data Preview */}
              <div className="p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Data Preview</h4>
                {filePreview && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700">
                          {filePreview.headers.slice(0, 6).map((header, index) => (
                            <th key={index} className="px-4 py-3 text-left font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filePreview.sampleRows.slice(0, 5).map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-gray-100 dark:border-gray-700">
                            {row.slice(0, 6).map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                {String(cell).length > 30 ? String(cell).substring(0, 30) + '...' : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Analysis Options */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 border-t border-gray-200 dark:border-gray-600">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">AI Analysis Features</h4>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-gray-900 dark:text-white">Anomaly Detection</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                    <Shield className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-gray-900 dark:text-white">Bias Assessment</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-gray-900 dark:text-white">Quality Scoring</span>
                  </div>
                </div>

                {/* Visibility Toggle */}
                <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isPublic 
                          ? 'bg-blue-50 dark:bg-blue-900/30' 
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}>
                        {isPublic ? (
                          <Eye className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          {isPublic ? 'Public Dataset' : 'Private Dataset'}
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {isPublic 
                            ? 'Analysis will be visible to everyone in the explorer' 
                            : 'Analysis will only be visible to you'
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsPublic(!isPublic)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        isPublic ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isPublic ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <Info className="w-4 h-4" />
                    <span>Analysis will be stored permanently on Filecoin</span>
                  </div>
                  <button 
                    onClick={startAnalysis}
                    disabled={isAnalyzing}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{isAnalyzing ? 'Starting Analysis...' : 'Start AI Analysis'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Default: Upload step
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/20 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Upload Your Dataset</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Upload any CSV, JSON, or Excel file to get instant AI-powered analysis with complete transparency on Filecoin
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Upload Area */}
            <div>
              <div
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {dragActive ? 'Drop your file here' : 'Drag & drop your dataset'}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-8">
                  or <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline"
                  >
                    browse files
                  </button>
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,.xlsx,.xls"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />

                <div className="flex justify-center space-x-6 mb-8">
                  {Object.entries(supportedTypes).map(([type, config]) => (
                    <div key={type} className="flex items-center space-x-2">
                      <config.icon className={`w-5 h-5 text-${config.color}-600`} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{config.label}</span>
                    </div>
                  ))}
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Maximum file size: 100MB
                </div>
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </div>

            {/* Sample Datasets */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Or try a sample dataset</h3>
              <div className="space-y-4">
                {sampleDatasets.map((dataset, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2">{dataset.name}</h4>
                        <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">{dataset.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>{dataset.size}</span>
                          <span>•</span>
                          <span>{dataset.rows} rows</span>
                          <span>•</span>
                          <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{dataset.type}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleSampleDataset(dataset)}
                        className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Use Sample
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderContent()}
    </>
  );
};

export default FileScopeApp;