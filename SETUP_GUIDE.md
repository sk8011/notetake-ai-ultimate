# Quick Setup Guide - Notes App with Database & Authentication

## 🎯 Quick Start (5 minutes)

### Step 1: Install MongoDB

**Option A - MongoDB Atlas (Recommended - No local install needed)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create FREE account
3. Create a FREE cluster (M0)
4. Click "Connect" → "Connect your application"
5. Copy the connection string (looks like: `mongodb+srv://username:password@cluster...`)

**Option B - Local MongoDB**
- Windows: Download from https://www.mongodb.com/try/download/community
- Run installer, keep defaults

### Step 2: Get API Keys

**Cloudinary (for images)**
1. Go to https://cloudinary.com
2. Sign up for FREE account
3. Get your Cloud Name, API Key, API Secret from dashboard

**Groq (for AI chatbot)**
1. Go to https://console.groq.com
2. Sign up for FREE account
3. Create API key from console

### Step 3: Configure Server

```bash
# Navigate to server folder
cd server

# Create .env file and paste this (replace with YOUR values):
```

Copy this template to `server/.env`:
```env
PORT=3001
NODE_ENV=development

# Paste YOUR MongoDB connection string here:
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/notes-app

# Create a random secret (just type random characters):
JWT_SECRET=my-super-secret-key-12345

# Paste YOUR Cloudinary credentials:
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here

# Paste YOUR Groq API key:
GROQ_API_KEY=your_groq_api_key_here

CLIENT_URL=http://localhost:5173
```

### Step 4: Run the App

**Terminal 1 - Start Server:**
```bash
cd server
npm run dev
```
Wait for "MongoDB connected successfully" ✅

**Terminal 2 - Start Client:**
```bash
cd client
npm run dev
```

### Step 5: Use the App

1. Open http://localhost:5173
2. Click "Register" to create account
3. Start creating notes! 🎉

---

## ⚠️ Troubleshooting

### MongoDB Connection Failed?

**Using Atlas:**
- Check username/password in connection string
- Whitelist your IP: Atlas Dashboard → Network Access → Add IP → "Allow Access from Anywhere"

**Using Local:**
- Windows: Run `net start MongoDB` in Command Prompt (as Admin)
- Mac/Linux: Run `sudo systemctl start mongod`

### Can't login?

- Clear browser cookies
- Check server terminal for errors
- Verify MongoDB is connected

### Images won't upload?

- Verify Cloudinary credentials in server/.env
- Check file size (keep under 10MB)

### Chatbot not working?

- Verify GROQ_API_KEY in server/.env
- Check you have notes created (chatbot needs notes to work)

---

## 📝 Default Behavior

- **First time?** No notes exist - create your first one!
- **Notes storage:** All notes saved to MongoDB (not localStorage anymore)
- **User accounts:** Each user sees only their own notes
- **Sessions:** Login lasts 7 days
- **Images:** Uploaded to Cloudinary (not stored locally)

---

## 🎓 Learning Resources

**MongoDB:**
- MongoDB Atlas Setup: https://www.mongodb.com/docs/atlas/getting-started/

**JWT Authentication:**
- JWT.io: https://jwt.io/introduction

**Cloudinary:**
- Getting Started: https://cloudinary.com/documentation

---

## 🆘 Still Having Issues?

1. Make sure both terminals are running (server + client)
2. Check all .env variables are set correctly
3. Try restarting both server and client
4. Clear browser cache and cookies
5. Check console for error messages

---

## 📊 What Changed from Local Storage?

**Before (Local Storage):**
- Notes saved in browser
- No login required
- Data lost if browser cache cleared
- No multi-device sync

**Now (Database + Auth):**
- ✅ Notes saved in MongoDB
- ✅ Secure login required
- ✅ Data persists forever
- ✅ Access from any device
- ✅ Each user has private notes
- ✅ Password protected

---

## 🎯 Next Steps

Want to deploy this app online? Check out:
- **Frontend:** Vercel, Netlify
- **Backend:** Render, Railway, Heroku
- **Database:** Already on MongoDB Atlas ✅

Need help? Check the main README.md for detailed documentation!
