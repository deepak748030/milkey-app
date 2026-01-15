<p align="center">
  <img src="milkey-app/assets/images/icon.png" alt="Milkey Logo" width="120" height="120" style="border-radius: 20px;">
</p>

<h1 align="center">🥛 Milkey - Dairy Management System</h1>

<p align="center">
  <strong>A comprehensive, production-grade dairy farm management platform</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#installation">Installation</a> •
  <a href="#api-documentation">API Docs</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-Expo_54-blue?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/Node.js-Express-green?logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/Database-MongoDB-success?logo=mongodb" alt="MongoDB">
  <img src="https://img.shields.io/badge/Admin-React_18-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

---

## 📋 Overview

**Milkey** is a full-stack dairy management solution designed to streamline operations for dairy farmers, milk collection centers, and dairy businesses. The platform provides end-to-end management capabilities including milk collection tracking, farmer management, payment processing, product ordering, and comprehensive reporting.

### Key Highlights

- 📱 **Cross-Platform Mobile App** - Built with Expo/React Native for iOS & Android
- 🖥️ **Web Admin Dashboard** - React-based admin panel with real-time analytics
- 🔐 **Secure REST API** - Express.js backend with JWT authentication
- 💳 **Integrated Payments** - Razorpay & ZapUPI payment gateway support
- 📊 **Advanced Reporting** - Generate detailed milk collection & payment reports
- 🔔 **Push Notifications** - Real-time notifications via Expo Push Service

---

## ✨ Features

### Mobile Application (React Native / Expo)

| Module | Description |
|--------|-------------|
| **Home Dashboard** | Overview of daily milk collection, earnings, and quick actions |
| **Purchase Management** | Record and track milk purchases from farmers |
| **Selling Management** | Manage milk sales to members/customers |
| **Farmer Registration** | Register and manage farmer profiles |
| **Payment Processing** | Process payments with multiple gateway support |
| **Advance Management** | Track and manage advance payments to farmers |
| **Order Management** | Browse products, add to cart, and place orders |
| **Analytics** | Visual charts and statistics for business insights |
| **Subscriptions** | Manage subscription plans and renewals |
| **Notifications** | Real-time push notifications |
| **Referral System** | Built-in referral program with rewards |
| **Profile Management** | User profile, settings, and preferences |

### Admin Dashboard (React / Vite)

| Module | Description |
|--------|-------------|
| **Dashboard** | Real-time metrics, charts, and KPIs |
| **User Management** | Manage all registered users and admins |
| **Farmer Management** | Complete farmer CRUD operations |
| **Product Management** | Manage product catalog and inventory |
| **Order Management** | View and process customer orders |
| **Payment Tracking** | Monitor all payment transactions |
| **Subscription Plans** | Create and manage subscription tiers |
| **Banner Management** | Control promotional banners in the app |
| **Custom Forms** | Create dynamic forms for data collection |
| **Reports** | Generate comprehensive business reports |
| **Settings** | System configuration and preferences |

### Backend API (Node.js / Express)

- RESTful API architecture with 25+ route modules
- JWT-based authentication with role-based access control
- MongoDB with Mongoose ODM for data persistence
- Rate limiting and security middleware (Helmet)
- Cloudinary integration for image uploads
- Email notifications via Nodemailer
- Push notification service via Expo
- Graceful shutdown and error handling

---

## 🏗️ Architecture

```
milkey/
├── milkey-app/              # React Native Mobile Application
│   ├── app/                 # Expo Router screens
│   │   ├── (tabs)/          # Tab navigation screens
│   │   │   ├── index.tsx    # Home screen
│   │   │   ├── purchase.tsx # Purchase management
│   │   │   ├── selling.tsx  # Selling management
│   │   │   ├── register.tsx # Registration screen
│   │   │   └── profile.tsx  # User profile
│   │   ├── auth.tsx         # Authentication screen
│   │   ├── cart.tsx         # Shopping cart
│   │   ├── orders.tsx       # Order history
│   │   ├── payment.tsx      # Payment processing
│   │   ├── analytics.tsx    # Analytics dashboard
│   │   ├── subscriptions.tsx # Subscription management
│   │   └── ...              # Other screens
│   ├── components/          # Reusable UI components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities & API client
│   └── assets/              # Images, fonts, sounds
│
├── server/                  # Node.js Backend API
│   ├── index.js             # Application entry point
│   ├── routes/              # API route handlers
│   │   ├── auth.js          # Authentication routes
│   │   ├── users.js         # User management
│   │   ├── farmers.js       # Farmer operations
│   │   ├── milk-collections.js  # Milk collection records
│   │   ├── payments.js      # Payment processing
│   │   ├── orders.js        # Order management
│   │   ├── products.js      # Product catalog
│   │   ├── subscriptions.js # Subscription handling
│   │   └── ...              # 15+ more route modules
│   ├── models/              # Mongoose schemas
│   │   ├── User.js          # User model
│   │   ├── Farmer.js        # Farmer model
│   │   ├── MilkCollection.js # Collection records
│   │   ├── Payment.js       # Payment records
│   │   └── ...              # 20+ data models
│   ├── middleware/          # Express middleware
│   │   ├── auth.js          # JWT verification
│   │   └── subscription.js  # Subscription validation
│   └── lib/                 # Utility modules
│       ├── cloudinary.js    # Image upload service
│       └── pushNotifications.js # Expo push service
│
├── src/                     # React Admin Dashboard
│   ├── pages/               # Dashboard pages
│   │   ├── DashboardPage.tsx    # Main dashboard
│   │   ├── UsersPage.tsx        # User management
│   │   ├── RegisterFarmersPage.tsx  # Farmer management
│   │   ├── ProductsPage.tsx     # Product management
│   │   ├── AdminOrdersPage.tsx  # Order management
│   │   ├── SubscriptionsPage.tsx # Subscription plans
│   │   └── ...                  # 20+ admin pages
│   ├── components/          # Shared components
│   ├── context/             # React context providers
│   └── lib/                 # Utilities & API client
│
└── docs/                    # Documentation
```

---

## 🚀 Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 or **yarn** >= 1.22.0
- **MongoDB** >= 6.0 (local or Atlas cluster)
- **Expo CLI** >= 6.0.0 (for mobile development)
- **Git** >= 2.30.0

### 1. Clone the Repository

```bash
git clone https://github.com/deepak748030/milkey-app.git
cd milkey-app
```

### 2. Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

**Environment Variables (server/.env):**

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Connection
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/milkey

# JWT Authentication
JWT_SECRET=your_secure_jwt_secret_key
JWT_EXPIRES_IN=7d

# Cloudinary (Image Uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Service (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Payment Gateways
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
ZAPUPI_TOKEN_KEY=your_zapupi_token
ZAPUPI_SECRET_KEY=your_zapupi_secret
```

### 3. Mobile App Setup

```bash
# Navigate to mobile app directory
cd milkey-app

# Install dependencies
npm install

# Start Expo development server
npm run dev
```

**Configure API Endpoint:**

Update the API base URL in `milkey-app/lib/milkeyApi.ts`:

```typescript
const API_BASE_URL = 'https://your-api-domain.com/api';
```

### 4. Admin Dashboard Setup

```bash
# From project root
npm install

# Start development server
npm run dev
```

---

## 📡 API Documentation

### Base URL

```
Production: https://api.milkey.app/api
Development: http://localhost:5000/api
```

### Authentication

All protected endpoints require JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### API Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | User login |
| POST | `/auth/verify-otp` | Verify OTP |
| GET | `/auth/me` | Get current user |

#### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List all users (Admin) |
| GET | `/users/:id` | Get user by ID |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |

#### Farmers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/farmers` | List farmers |
| POST | `/farmers` | Create farmer |
| PUT | `/farmers/:id` | Update farmer |
| DELETE | `/farmers/:id` | Delete farmer |

#### Milk Collections
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/milk-collections` | List collections |
| POST | `/milk-collections` | Record collection |
| GET | `/milk-collections/report` | Generate report |
| DELETE | `/milk-collections/:id` | Delete record |

#### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payments` | List payments |
| POST | `/payments` | Create payment |
| GET | `/payments/farmer/:id` | Farmer payments |

#### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List products |
| POST | `/products` | Create product (Admin) |
| PUT | `/products/:id` | Update product |
| DELETE | `/products/:id` | Delete product |

#### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orders` | List orders |
| POST | `/orders` | Place order |
| PUT | `/orders/:id/status` | Update status |

#### Subscriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subscriptions` | List plans |
| POST | `/user-subscriptions` | Subscribe user |
| GET | `/user-subscriptions/status` | Check status |

<details>
<summary><strong>View All Endpoints (25+ Routes)</strong></summary>

- `/api/admin` - Admin operations
- `/api/advances` - Advance payments
- `/api/referrals` - Referral system
- `/api/rate-charts` - Rate configurations
- `/api/reports` - Report generation
- `/api/feedback` - User feedback
- `/api/members` - Member management
- `/api/selling-entries` - Selling records
- `/api/member-payments` - Member payments
- `/api/notifications` - Push notifications
- `/api/withdrawals` - Withdrawal requests
- `/api/custom-forms` - Dynamic forms
- `/api/banners` - Banner management
- `/api/razorpay` - Razorpay integration
- `/api/zapupi` - ZapUPI integration

</details>

---

## 🌐 Deployment

### Backend Deployment (Vercel)

The server is configured for Vercel deployment:

```json
// server/vercel.json
{
  "version": 2,
  "builds": [{ "src": "index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "index.js" }]
}
```

```bash
cd server
vercel --prod
```

### Admin Dashboard Deployment (Vercel)

```bash
# From project root
npm run build
vercel --prod
```

### Mobile App Deployment (EAS)

```bash
cd milkey-app

# Build for Android
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

---

## 🛠️ Tech Stack

### Mobile App
| Technology | Purpose |
|------------|---------|
| React Native | Cross-platform mobile framework |
| Expo SDK 54 | Development platform & build tools |
| Expo Router | File-based navigation |
| Zustand | State management |
| React Native Reanimated | Animations |
| Lucide React Native | Icon library |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | JavaScript runtime |
| Express.js | Web framework |
| MongoDB | NoSQL database |
| Mongoose | MongoDB ODM |
| JWT | Authentication |
| Helmet | Security middleware |
| Nodemailer | Email service |

### Admin Dashboard
| Technology | Purpose |
|------------|---------|
| React 18 | UI library |
| Vite | Build tool |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| React Router | Navigation |
| Recharts | Data visualization |

---

## 📊 Database Schema

### Core Models

```javascript
// User Model
{
  name: String,
  phone: String (unique),
  email: String,
  password: String (hashed),
  role: ['user', 'admin'],
  isActive: Boolean,
  pushToken: String,
  createdAt: Date
}

// Farmer Model
{
  userId: ObjectId,
  name: String,
  phone: String,
  address: String,
  bankDetails: Object,
  createdAt: Date
}

// MilkCollection Model
{
  userId: ObjectId,
  farmerId: ObjectId,
  date: Date,
  session: ['morning', 'evening'],
  quantity: Number,
  fat: Number,
  snf: Number,
  rate: Number,
  amount: Number
}

// Payment Model
{
  userId: ObjectId,
  farmerId: ObjectId,
  amount: Number,
  paymentMethod: String,
  status: ['pending', 'completed'],
  transactionId: String,
  createdAt: Date
}
```

---

## 🧪 Testing

```bash
# Run backend tests
cd server
npm test

# Run mobile app type checking
cd milkey-app
npm run typecheck

# Run admin dashboard type checking
npm run typecheck
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards

- Follow ESLint configuration
- Use TypeScript strict mode
- Write meaningful commit messages
- Add JSDoc comments for functions
- Ensure all tests pass before PR

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

<p align="center">
  <strong>Deepak Kushwah</strong>
  <br>
  Full-Stack Developer
  <br><br>
  <a href="https://github.com/deepak748030">
    <img src="https://img.shields.io/badge/GitHub-deepak748030-181717?logo=github" alt="GitHub">
  </a>
</p>

---

## 📞 Support

For support, email **deepakkushwah748930@gmail.com** or open an issue on GitHub.

---

<p align="center">
  Made with ❤️ by Deepak Kushwah
</p>
