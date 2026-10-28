# IntelliStock - AI Stock Predictor Platform

A comprehensive full-stack application for AI-powered stock market predictions and analysis.

## 🏗️ Architecture

The project is organized into three main folders:

### 📁 client/
React frontend application with modern UI/UX
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS with custom design system
- **Routing**: React Router DOM v7 (library mode)
- **Charts**: Recharts for data visualization
- **Animations**: Framer Motion
- **State Management**: Context API
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **Initial bundle**: route-level lazy-loaded page chunks

### 📁 server/
Node.js backend API server
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcryptjs
- **Security**: Helmet, strict CSP, CORS allowlist, rate limiting, request-key validation
- **Environment**: dotenv configuration

### 📁 ml-server/
Python Flask server for AI predictions
- **Framework**: Flask with Flask-CORS
- **Data**: yfinance for real stock data
- **Analysis**: pandas, numpy for data processing
- **ML**: scikit-learn for predictions
- **Technical Indicators**: RSI, MACD, Moving Averages

## 🚀 Features

### Frontend Features
- **Landing Page**: Engaging hero section with smooth animations
- **Authentication**: Login/Register with form validation
- **Dashboard**: Portfolio overview with interactive charts
- **Stock Predictor**: Search stocks, generate AI predictions
- **News Feed**: Market news with sentiment analysis
- **Watchlist**: Track favorite stocks with predictions
- **Admin Panel**: User management and analytics (admin only)
- **Responsive Design**: Mobile-first approach with Tailwind CSS

### Backend Features
- **User Management**: Registration, authentication, profiles
- **Stock Data**: Search, historical data, predictions
- **Watchlist**: Add/remove stocks, user preferences
- **Admin Controls**: User management, system analytics
- **Security**: JWT authentication, input validation, rate limiting

### ML Server Features
- **Stock Predictions**: 1-30 day price forecasts
- **Technical Analysis**: RSI, MACD, Moving Averages
- **Sentiment Analysis**: Market sentiment scoring
- **Real Data**: Integration with Yahoo Finance API
- **Multiple Models**: Technical, sentiment, and hybrid models

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 20.19+ and npm (Vite 7 requires this baseline)
- Python 3.8+ and pip
- MongoDB (local or cloud)

### 0. Quick start (recommended)

From the repository root:

```bash
npm run install:all          # installs client + server dependencies
cp server/.env.example server/.env   # then fill in JWT_SECRET
npm run seed                 # creates the demo accounts listed below
npm run dev:server           # API on http://localhost:5000
npm run dev                  # client on http://localhost:3000
npm run dev:ml               # optional: ML service on http://localhost:8000
npm run lint                 # ESLint over client/src and server
npm test                     # unit + API regression suite (MongoDB required)
npm run audit                # high/critical dependency advisory gate
```

`VITE_API_URL` is optional in development: the Vite dev server proxies `/api`
to `http://localhost:5000`.

The root `package.json` requires Node 20.19+ (Vite 7's runtime requirement). The client, API and lint commands are run from the root; the ML server remains a separately managed Python service.

### 1. Client Setup
```bash
cd client
npm install
npm run dev
```
The client will run on http://localhost:3000

### 2. Server Setup
```bash
cd server
npm install

# Create .env file with:
PORT=5000
MONGODB_URI=mongodb://localhost:27017/intellistock
JWT_SECRET=your-super-secret-jwt-key
NODE_ENV=development
ML_SERVER_URL=http://localhost:8000

npm run dev
```
The server will run on http://localhost:5000

### 3. ML Server Setup
```bash
cd ml-server
pip install -r requirements.txt

# Create .env file with:
FLASK_ENV=development
PORT=8000

python app.py
```
The ML server will run on http://localhost:8000

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Stocks
- `GET /api/stocks/:symbol` - Get stock data
- `GET /api/stocks/search/:query` - Search stocks
- `POST /api/stocks/predict` - Generate prediction
- `GET /api/stocks/:symbol/history` - Historical data
- `GET /api/stocks/news/:symbol?` - Market news

### Users
- `GET /api/users/profile` - User profile
- `POST /api/users/watchlist` - Add to watchlist
- `DELETE /api/users/watchlist/:symbol` - Remove from watchlist

### Admin
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/users` - All users
- `PUT /api/admin/users/:id/status` - Update user status

### ML Server
- `POST /predict` - Generate stock prediction
- `GET /sentiment/:symbol` - Sentiment analysis
- `GET /technical/:symbol` - Technical analysis
- `GET /models` - Available models

## 🎨 Design System

### Colors
- **Primary**: Blue (#3B82F6) - Main brand color
- **Secondary**: Purple (#8B5CF6) - Accent color
- **Success**: Green (#10B981) - Positive indicators
- **Warning**: Yellow (#F59E0B) - Neutral indicators
- **Error**: Red (#EF4444) - Negative indicators
- **Background**: Gray-900 (#111827) - Dark theme

### Typography
- **Font**: Inter (Google Fonts)
- **Headings**: 600-700 weight
- **Body**: 400-500 weight
- **Scale**: Tailwind's default scale

### Components
- **Cards**: Rounded corners, subtle shadows
- **Buttons**: Primary/secondary variants with hover states
- **Forms**: Consistent styling with validation
- **Charts**: Recharts with custom theming

## 🔐 Security Features

- JWT authentication with a 32-character minimum secret in production
- Password hashing with bcryptjs (cost factor 12)
- Rate limiting to reduce abuse of API and authentication routes
- Input validation, bounded request sizes, and MongoDB operator-key rejection
- Strict CORS origin allowlist
- Helmet security headers and browser CSP
- `.env` protection and a CI dependency-audit gate
- API auth lookup cache invalidated immediately on account status changes

## 📱 Responsive Design

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Flexible grid layouts
- Touch-friendly interactions
- Optimized for all screen sizes

## 🧪 Demo Credentials

### Admin Access
- Email: admin@intellistock.com
- Password: password123

### Regular User
- Email: user@example.com
- Password: password123

## 🚀 Deployment

### Client (Netlify/Vercel)
```bash
cd client
npm run build
# Deploy dist/ folder
```

### Server (Heroku/Railway)
```bash
cd server
# Set environment variables
# Deploy with npm start
```

### ML Server (Railway/Render)
```bash
cd ml-server
# Set environment variables
# Deploy with python app.py
```

## 📈 Future Enhancements

- Real-time stock data streaming
- Advanced ML models (LSTM, Transformer)
- Social trading features
- Mobile app development
- Advanced portfolio analytics
- Options and crypto support
- Paper trading simulation
- Advanced charting tools

## 🔧 Troubleshooting Yahoo Finance Data

Quote and news lookups go through [yahooFinanceClient.js](server/utils/yahooFinanceClient.js), a wrapper that makes `yahoo-finance2` resilient. Three failure modes were diagnosed and fixed here:

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| `Timeout of 10000ms exceeded` | Provider occasionally takes >10s; no timeout or retry configured | A 6-second timeout with a small internal exponential-backoff retry loop; 429s are not retried |
| `SyntaxError: Unexpected token '<'` | Yahoo returns an HTML error page instead of JSON when rate-limited or blocked | HTML responses are detected and classified instead of being parsed as JSON |
| `historical()` deprecation warnings | `historical()` is being phased out in `yahoo-finance2` | Replaced with the stable `chart()` API |

The client also applies a TTL cache with in-flight de-duplication so concurrent requests for the same symbol share one upstream call. When Yahoo rate-limits the calling IP, affected endpoints return a clean `503` with a user-facing message rather than a `500`.

## 🔒 Runtime security settings

- Set `CLIENT_ORIGIN` to a comma-separated list of the exact web origins allowed to call the API.
- Set `JWT_SECRET` to a cryptographically random value of at least 32 characters in production.
- `AUTH_USER_CACHE_MS` controls the short-lived auth lookup cache (default `5000` ms); set it to `0` to disable. Status changes and account deletion evict cached entries immediately in the current server process; in multi-process deployments, other processes may retain a cached status until the short TTL expires.
- If the client calls a separate API origin, set `VITE_API_URL` to that API origin at build time. Production builds reject non-HTTPS API origins; the generated CSP allows only that API origin for connections.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Yahoo Finance for stock data
- Tailwind CSS for styling framework
- Recharts for data visualization
- Framer Motion for animations
- MongoDB for database
- Flask for ML server framework