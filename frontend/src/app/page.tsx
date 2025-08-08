'use client'
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { 
  Database, Upload, Shield, CheckCircle, 
  Users, FileText, Zap, Brain, Eye,
  ArrowRight, Play, Building
} from 'lucide-react';
import toast from 'react-hot-toast';

const FileScope = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const { isConnected } = useAccount();
  const router = useRouter();

  // Auto-rotate features demo
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleUploadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isConnected) {
      toast.error('Please connect your wallet first to upload datasets', {
        duration: 4000,
        icon: '🔒',
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
      return;
    }
    router.push('/upload');
  };

  const handleExplorerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isConnected) {
      toast.error('Please connect your wallet first to explore datasets', {
        duration: 4000,
        icon: '🔒',
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
      return;
    }
    router.push('/explorer');
  };

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Analysis",
      description: "Advanced algorithms detect anomalies, bias, and quality issues automatically",
      demo: "Analyzing 15,420 rows... Found 23 anomalies, Quality Score: 87%"
    },
    {
      icon: Shield,
      title: "Blockchain Verified",
      description: "Every analysis is permanently stored on Filecoin with cryptographic proof",
      demo: "Dataset verified ✓ Stored on IPFS: Qm...abc123 Block: #2,341,567"
    },
    {
      icon: Eye,
      title: "Public Transparency",
      description: "Browse and verify any dataset analysis with full transparency",
      demo: "2,847 datasets analyzed • 156 researchers contributed • 100% verifiable"
    }
  ];

  const useCases = [
    {
      icon: FileText,
      title: "Journalists",
      description: "Verify data sources and detect manipulation in public datasets",
      example: "Election polling data integrity verification"
    },
    {
      icon: Users,
      title: "Researchers",
      description: "Access clean, bias-checked datasets with confidence",
      example: "Climate data validation for academic studies"
    },
    {
      icon: Building,
      title: "Organizations",
      description: "Publish transparent, auditable datasets with quality guarantees",
      example: "Government transparency reports"
    }
  ];

  const stats = [
    { number: "10K+", label: "Datasets Analyzed" },
    { number: "99.2%", label: "Accuracy Rate" },
    { number: "500+", label: "Active Users" },
    { number: "24/7", label: "Uptime" }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4 bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-medium mb-8 border border-blue-200 dark:border-blue-800">
              <Zap className="w-4 h-4" />
              <span>Powered by Filecoin & Advanced AI</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-8 leading-tight">
              Turn Any Dataset Into
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Trusted Intelligence
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
              Upload datasets, get instant AI analysis with anomaly detection, bias assessment, and quality scoring. 
              Everything stored permanently on Filecoin for complete transparency.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-16">
              <button 
                onClick={handleUploadClick}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center space-x-2"
              >
                <Upload className="w-5 h-5" />
                <span>Analyze Your Dataset</span>
              </button>
              
              <button 
                onClick={handleUploadClick}
                className="border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-8 py-4 rounded-xl font-semibold text-lg hover:border-gray-400 dark:hover:border-gray-500 transition-all flex items-center space-x-2"
              >
                <Play className="w-5 h-5" />
                <span>Launch App</span>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">{stat.number}</div>
                  <div className="text-gray-600 dark:text-gray-400 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Features Demo */}
      <section id="features" className="py-24 px-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              AI That Actually <span className="text-blue-600">Understands</span> Your Data
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Our advanced AI doesn&apos;t just store your data—it analyzes, validates, and provides insights 
              that help you make better decisions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Feature Navigation */}
            <div className="order-2 md:order-1">
              <div className="space-y-6">
                {features.map((feature, index) => (
                  <div 
                    key={index}
                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${
                      activeFeature === index 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-lg' 
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => setActiveFeature(index)}
                  >
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-xl ${
                        activeFeature === index ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        <feature.icon className={`w-6 h-6 ${
                          activeFeature === index ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                          {feature.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature Demo */}
            <div className="order-1 md:order-2">
              <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700">
                <div className="mb-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="bg-gray-900 dark:bg-black text-green-400 p-4 rounded-lg font-mono text-sm">
                    <div className="mb-2">$ filescope analyze dataset.csv</div>
                    <div className="text-gray-400">{features[activeFeature].demo}</div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="font-medium text-gray-900 dark:text-white">Quality Score</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{width: '87%'}}></div>
                      </div>
                      <span className="font-bold text-green-600">87%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="font-medium text-gray-900 dark:text-white">Anomalies Detected</span>
                    <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-full text-sm font-medium">
                      23 Found
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="font-medium text-gray-900 dark:text-white">Blockchain Status</span>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-green-600 dark:text-green-400 font-medium">Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Simple Process, <span className="text-blue-600">Powerful Results</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              From upload to insights in minutes. No complex setup, no technical expertise required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">1. Upload Dataset</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Drag and drop your CSV, JSON, or Excel file. We support datasets up to 100MB with automatic format detection.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Brain className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">2. AI Analysis</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Our AI analyzes your data for anomalies, bias, completeness, and quality issues using advanced algorithms.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">3. Permanent Storage</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Results are stored on Filecoin with blockchain verification, ensuring permanent accessibility and trust.
              </p>
            </div>
          </div>

          <div className="text-center mt-16">
            <button 
              onClick={handleUploadClick}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
            >
              Try It Now - It&apos;s Free
            </button>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-24 px-4 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Built for <span className="text-blue-600">Real-World Impact</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Whether you&apos;re a journalist, researcher, or organization, FileScope AI helps you work with data you can trust.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {useCases.map((useCase, index) => (
              <div key={index} className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-6">
                  <useCase.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{useCase.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">{useCase.description}</p>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Example:</div>
                  <div className="font-medium text-gray-900 dark:text-white">{useCase.example}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
            Ready to Trust Your Data?
          </h2>
          <p className="text-xl text-blue-100 mb-12 leading-relaxed">
            Join hundreds of researchers, journalists, and organizations using FileScope AI 
            to analyze and verify their datasets with confidence.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            <button 
              onClick={handleUploadClick}
              className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-all shadow-lg flex items-center space-x-2"
            >
              <Upload className="w-5 h-5" />
              <span>Start Analyzing Now</span>
            </button>
            
            <button 
              onClick={handleExplorerClick}
              className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white hover:text-blue-600 transition-all flex items-center space-x-2"
            >
              <span>Explore Datasets</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">FileScope AI</span>
              </div>
              <p className="text-gray-400 leading-relaxed max-w-md">
                The decentralized intelligence layer for public datasets. 
                Turning Filecoin storage into a trusted, queryable data lake.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <div className="space-y-2 text-gray-400">
                <div>Features</div>
                <div>How it Works</div>
                <div>Use Cases</div>
                <div>API Docs</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <div className="space-y-2 text-gray-400">
                <div>About</div>
                <div>Blog</div>
                <div>Careers</div>
                <div>Contact</div>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm">
              © 2025 FileScope AI. Built for Filecoin.
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <div className="text-gray-400 hover:text-white cursor-pointer">Privacy</div>
              <div className="text-gray-400 hover:text-white cursor-pointer">Terms</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FileScope;