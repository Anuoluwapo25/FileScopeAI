# FileScope AI 🤖📊

## Decentralized AI-Powered Dataset Analysis & Verification Platform

**Built for EthNigeria 2025 Hackathon**

FileScope AI transforms any dataset into trusted intelligence through advanced AI analysis, anomaly detection, and blockchain verification. Upload your data, get instant insights, and store results permanently on Filecoin for complete transparency.

---

## 🎯 Problem Statement

In today's data-driven world, datasets are often:
- **Unreliable**: Hidden biases, anomalies, and quality issues
- **Unverifiable**: No way to trust the analysis or detect manipulation
- **Inaccessible**: Complex tools requiring data science expertise

FileScope AI solves this by providing **AI-powered analysis with blockchain verification** that anyone can use and trust.

---

## 🚀 Key Features

### 🧠 Advanced AI Analysis Engine
- **Quality Scoring Algorithm**: Comprehensive dataset evaluation (0-100 score)
- **Anomaly Detection**: Statistical outlier identification using multiple methods
- **Bias Assessment**: Algorithmic bias detection across protected attributes
- **Data Profiling**: Automated schema inference and statistical analysis
- **Missing Data Analysis**: Intelligent gap detection and impact assessment
- **Correlation Discovery**: Advanced relationship mapping between variables

### 🔗 Blockchain Integration
- **Filecoin Storage**: Permanent, decentralized dataset storage
- **IPFS Integration**: Content-addressed storage with cryptographic verification
- **Immutable Analysis**: Tamper-proof analysis results on blockchain
- **Public Verification**: Anyone can verify analysis integrity

### 📊 Smart Visualizations
- **Auto-Generated Charts**: Distribution plots, correlation matrices, outlier visualizations
- **Interactive Dashboards**: Real-time exploration of analysis results
- **Bias Visualization**: Clear representation of detected biases
- **Quality Metrics**: Visual quality scorecards and improvement suggestions

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  Django Backend │    │  AI Engine      │
│   (Next.js)     │◄──►│  (REST API)     │◄──►│  (Python/ML)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       ▼
         │                       │              ┌─────────────────┐
         │                       │              │  Analysis Stack │
         │                       │              │  • Pandas       │
         │                       │              │  • NumPy        │
         │                       │              │  • SciPy        │
         │                       │              │  • Scikit-learn │
         │                       │              └─────────────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │  Filecoin/IPFS  │
         │              │  Storage Layer  │
         │              └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Web3 Wallet    │
│  Integration    │
│  (WalletConnect)│
└─────────────────┘
```

---

## 🔬 AI Analysis Components

### 1. **Quality Score Calculation**
```python
def calculate_quality_score(df):
    """
    Comprehensive quality assessment with 4 key dimensions:
    
    - Completeness (40%): Missing data analysis
    - Size Adequacy (30%): Statistical power assessment  
    - Data Consistency (30%): Type validation & naming quality
    """
```

**Key Algorithms:**
- Missing data pattern analysis
- Statistical power calculations
- Data type consistency validation
- Column naming quality assessment
- Duplicate detection algorithms

### 2. **Anomaly Detection Engine**
```python
def detect_anomalies(df):
    """
    Multi-method anomaly detection:
    
    - Statistical methods (IQR, Z-score, Modified Z-score)
    - Machine learning approaches (Isolation Forest, Local Outlier Factor)
    - Domain-specific rules for categorical data
    """
```

**Implemented Methods:**
- **Isolation Forest**: Unsupervised anomaly detection for numerical data
- **Local Outlier Factor**: Density-based outlier detection
- **Statistical Outliers**: IQR, Z-score, and Grubbs' test
- **Categorical Anomalies**: Frequency-based rare category detection

### 3. **Bias Detection System**
```python
def analyze_bias(df, protected_attributes):
    """
    Comprehensive bias analysis across multiple dimensions:
    
    - Demographic parity assessment
    - Equal opportunity violations
    - Statistical parity testing
    - Intersectional bias detection
    """
```

**Bias Metrics:**
- **Demographic Parity**: Equal representation across groups
- **Equal Opportunity**: Fair positive outcome rates
- **Predictive Parity**: Consistent accuracy across groups
- **Individual Fairness**: Similar individuals receive similar outcomes

### 4. **Advanced Statistics Engine**
```python
def get_detailed_statistics(df):
    """
    Deep statistical profiling:
    
    - Distribution analysis (normality tests, skewness, kurtosis)
    - Correlation analysis (Pearson, Spearman, Kendall)
    - Entropy calculations for information content
    - Statistical significance testing
    """
```

---

## 📦 Technology Stack

### Backend (Django)
```python
# Core AI/ML Libraries
pandas>=1.5.0           # Data manipulation and analysis
numpy>=1.21.0           # Numerical computing
scipy>=1.9.0            # Statistical analysis
scikit-learn>=1.1.0     # Machine learning algorithms
matplotlib>=3.5.0       # Data visualization
seaborn>=0.11.0         # Statistical visualization
plotly>=5.10.0          # Interactive visualizations

# Statistical Analysis
statsmodels>=0.13.0     # Advanced statistical modeling
pyod>=1.0.0            # Outlier detection algorithms
imbalanced-learn>=0.9.0 # Bias detection utilities

# Data Processing
openpyxl>=3.0.0        # Excel file processing
xlrd>=2.0.0            # Excel legacy support
chardet>=4.0.0         # Character encoding detection

# Blockchain Integration
web3>=6.0.0            # Ethereum interaction
ipfshttpclient>=0.8.0  # IPFS integration
filecoin-py>=0.1.0     # Filecoin storage API
```

### Frontend (React/Next.js)
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "wagmi": "^1.4.0",           // Web3 wallet integration
    "viem": "^1.16.0",           // Ethereum interactions
    "recharts": "^2.8.0",        // Data visualization
    "lucide-react": "^0.263.0",  // Icons
    "tailwindcss": "^3.3.0"      // Styling
  }
}
```

---

## 🧪 AI Analysis Examples

### Quality Score Breakdown
```python
# Real analysis output from our algorithm
{
  "total_score": 87.5,
  "component_scores": {
    "completeness": 35.2,    # 88% of max 40 points
    "size": 25.0,            # 83% of max 30 points  
    "consistency": 27.3      # 91% of max 30 points
  },
  "grade": "B",
  "detailed_metrics": {
    "missing_percentage": 2.3,
    "duplicate_percentage": 1.1,
    "type_consistency_score": 94.2
  }
}
```

### Anomaly Detection Results
```python
# Multi-method anomaly detection output
{
  "total_anomalies": 23,
  "detection_methods": {
    "isolation_forest": 15,
    "statistical_outliers": 12,
    "local_outlier_factor": 8
  },
  "anomaly_severity": {
    "high": 5,
    "medium": 10, 
    "low": 8
  },
  "affected_columns": ["age", "income", "transaction_amount"]
}
```

### Bias Analysis Output
```python
# Comprehensive bias assessment
{
  "overall_bias_score": 0.23,  # 0 = no bias, 1 = maximum bias
  "protected_attributes": ["gender", "age_group", "ethnicity"],
  "bias_metrics": {
    "demographic_parity": 0.15,
    "equal_opportunity": 0.31,
    "predictive_parity": 0.22
  },
  "recommendations": [
    "Consider rebalancing gender representation",
    "Age group disparities detected in outcome rates"
  ]
}
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL 13+
- Redis (for caching)

### Backend Setup
```bash
# Clone repository
git clone https://github.com/your-username/filescope-ai
cd filescope-ai/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install AI/ML dependencies
pip install -r requirements.txt

# Install additional ML packages for advanced analysis
pip install pyod imbalanced-learn statsmodels

# Setup database
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

### Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Add your Web3 project ID and API endpoints

# Start development server
npm run dev
```

### Environment Variables
```env
# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost/filescope
REDIS_URL=redis://localhost:6379
FILECOIN_API_KEY=your_filecoin_api_key
IPFS_NODE_URL=https://ipfs.infura.io:5001

# Frontend (.env.local)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

---

## 📊 API Documentation

### Upload & Analyze Dataset
```http
POST /api/upload/
Content-Type: multipart/form-data

Parameters:
- file: Dataset file (CSV, JSON, Excel, Parquet)
- name: Optional dataset name
- description: Optional description
- include_visualizations: boolean (default: false)
- analysis_depth: "basic" | "full" (default: "basic")
```

### Response Format
```json
{
  "success": true,
  "analysis_id": "uuid4-string",
  "status": "completed",
  "dataset_info": {
    "rows": 15420,
    "columns": 28,
    "file_type": "csv",
    "missing_percentage": 2.3
  },
  "results": {
    "quality_score": {
      "total_score": 87.5,
      "grade": "B",
      "component_scores": {...}
    },
    "basic_metrics": {...},
    "insights": [
      "High quality dataset with minimal missing data",
      "23 statistical outliers detected in 'income' column",
      "Potential bias detected in age distribution"
    ]
  },
  "visualizations": {
    "available": ["correlation_matrix", "distribution_income"],
    "included": false,
    "count": 12
  }
}
```

---

## 🔍 Supported File Formats

| Format | Extension | Max Size | Special Features |
|--------|-----------|----------|------------------|
| CSV | `.csv` | 100MB | Auto-delimiter detection |
| JSON | `.json` | 100MB | Nested structure support |
| Excel | `.xlsx`, `.xls` | 100MB | Multi-sheet analysis |
| Parquet | `.parquet` | 100MB | Optimized columnar format |
| TSV | `.tsv` | 100MB | Tab-separated values |
| Plain Text | `.txt` | 100MB | Structure auto-detection |

---

## 🎯 Use Cases

### 1. **Journalism & Media**
- Verify data sources for investigative reporting
- Detect manipulation in public datasets
- Ensure story accuracy with bias analysis

### 2. **Academic Research**
- Validate research datasets for publications
- Detect sampling biases in studies
- Ensure reproducible research with blockchain verification

### 3. **Government & NGOs**
- Publish transparent, auditable datasets
- Ensure fairness in policy-related data
- Provide public verification of official statistics

### 4. **Business Intelligence**
- Validate data quality before analysis
- Detect anomalies in business metrics
- Ensure fair AI/ML model training data

---

## 🏆 Hackathon Innovation

### What Makes FileScope AI Special?

1. **Real AI, Not Mock Data**: Our analysis engine uses proven ML algorithms (Isolation Forest, LOF, statistical tests) for genuine insights

2. **Blockchain Verification**: First platform to combine AI dataset analysis with permanent Filecoin storage

3. **Public Good Focus**: Designed for transparency, journalism, and research rather than just commercial use

4. **Comprehensive Analysis**: Goes beyond basic statistics to include bias detection, anomaly identification, and quality scoring

5. **User-Friendly**: Complex AI made accessible through intuitive interface

### Technical Innovation
- Custom quality scoring algorithm with 30+ metrics
- Multi-method anomaly detection ensemble
- Real-time bias assessment across multiple fairness criteria
- Automatic visualization generation based on data types
- Blockchain-verified analysis integrity

---

## 🔗 Demo & Links

- **Live Demo**: [https://filescope-ai.vercel.app](https://filescope-ai.vercel.app)
- **API Playground**: [https://api.filescope-ai.com/docs](https://api.filescope-ai.com/docs)
- **Dataset Explorer**: [https://explorer.filescope-ai.com](https://explorer.filescope-ai.com)

---

## 📈 Future Roadmap

### Phase 1 (Current)
- ✅ Core AI analysis engine
- ✅ Basic Filecoin integration
- ✅ Web interface

### Phase 2 (Next 3 months)
- 🔄 Advanced ML models for domain-specific analysis
- 🔄 Real-time collaboration features
- 🔄 API monetization for enterprise users

### Phase 3 (6 months)
- 📋 Federated learning across datasets
- 📋 DAO governance for platform development
- 📋 Mobile app with AR data visualization

---

## 👥 Team

- **Data Science Lead**: AI algorithm development and statistical analysis
- **Blockchain Developer**: Filecoin integration and smart contracts  
- **Full-Stack Developer**: Platform architecture and user experience
- **UI/UX Designer**: Interface design and user research

---

## 📜 License

MIT License - Built for EthNigeria 2025 Hackathon

---

## 🙏 Acknowledgments

- **EthNigeria 2025** for the amazing hackathon experience
- **Filecoin Foundation** for decentralized storage infrastructure
- **Open-source ML community** for the incredible tools and libraries
- **Web3 ecosystem** for making decentralized applications possible

---

*"Turning every dataset into trusted intelligence, one upload at a time."* 🚀

