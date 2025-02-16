# Negotiation Copilot

An AI-powered assistant that helps you navigate complex, multi-turn negotiations with confidence and strategic insight.

## 🌟 Features

- Real-time negotiation guidance
- Multi-turn conversation simulation
- Strategic planning with Monte Carlo Tree Search
- Performance tracking and analytics
- Secure authentication
- Interactive web interface

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/tthuwng/negotiation-pilot.git

# Install dependencies
cd negotiation-copilot
cd backend/
pip install -r requirements.txt
npm install

cd ..
cd frontend/
pnpm i

# Set up environment variables in both backend and frontend
cp .env.example .env

# Run the development server
cd backend/ && python main.py
cd frontend/ && pnpm dev


```

## 🛠️ Tech Stack

- **Frontend**: React, Next.js
- **Backend**: FastAPI
- **Authentication**: Stytch
- **Database**: Supabase
- **AI/ML**: Together.ai
- **Analytics**: Weights & Biases

## 🔧 Configuration

1. Create accounts with:

   - Stytch (authentication)
   - Supabase (database)
   - Together.ai (AI model)
   - Weights & Biases (analytics)

2. Add your API keys to `.env`:

```bash
STYTCH_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_KEY=your_key
TOGETHER_API_KEY=your_key
WANDB_API_KEY=your_key
```

## 📖 Usage

1. Sign up or log in to your account
2. Create a new negotiation scenario
3. Input your goals and constraints
4. Follow the AI-guided suggestions
5. Track your progress and outcomes

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Together.ai for AI capabilities
- Stytch team for authentication support
- Weights & Biases for analytics tools
- Supabase for database infrastructure
