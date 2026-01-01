# NoteGPT

A full-stack markdown note-taking application with real-time chat, AI integration, and cloud storage. Built with React, TypeScript, Node.js, Express, and MongoDB.

## Features

- User authentication with JWT tokens
- Markdown editor with live preview
- Tag-based organization
- Image uploads via Cloudinary
- AI-powered chatbot for querying notes (Groq)
- Real-time messaging between users (direct messaging + creating groups)
- Note sharing with friends
- Export notes to PDF
- Light and dark themes (along with default background image options + custom background image upload)
- Responsive design - works flawlessly for both pc and mobiles.

## Demo

### All Features (Notes, Chat, AI, Themes, etc.)
[▶️ Watch Demo Video 1](./Demos/demo1.gif)

### Note Sharing Feature
[▶️ Watch Demo Video 2](./Demos/demo2.gif)

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, React Bootstrap, Socket.io Client

**Backend:** Node.js, Express, MongoDB, Mongoose, Socket.io, JWT, Cloudinary

## Prerequisites

- Node.js v16 or higher
- MongoDB (local or Atlas)
- Cloudinary account
- Groq API key

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/sk8011/notetake-ai-ultimate.git
cd notetake-ai-ultimate
```

### 2. Install dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 3. Configure environment variables

Create `server/.env`:

```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/notes-app
JWT_SECRET=your-secret-key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GROQ_API_KEY=your_groq_api_key
CLIENT_URL=http://localhost:5173
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

### 4. Start the application

Start MongoDB (if local):
```bash
# Windows
net start MongoDB

# Linux/Mac
sudo systemctl start mongod
```

Start the server:
```bash
cd server
npm run dev
```

Start the client:
```bash
cd client
npm run dev
```

The app runs at http://localhost:5173

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user

### Notes
- `GET /api/notes` - List notes
- `GET /api/notes/:id` - Get note
- `POST /api/notes` - Create note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `DELETE /api/notes/bulk` - Delete multiple notes
- `GET /api/notes/export-all` - Export all as ZIP

### Tags
- `GET /api/tags` - List tags
- `PUT /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag

### Upload
- `POST /api/upload` - Upload image
- `DELETE /api/delete-image` - Delete image

### Chat
- `POST /api/chat` - AI chatbot

### Friends and Messaging
- `GET /api/users/browse` - Browse users
- `POST /api/friends/request` - Send friend request
- `GET /api/conversations` - List conversations
- `POST /api/messages` - Send message

## Project Structure

```
notetake-ai/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── styles/
│   │   ├── services/
│   │   ├── context/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── server/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── index.ts
│   └── package.json
└── README.md
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |

## License

MIT

## Links

- Repository: https://github.com/sk8011/notetake-ai-ultimate
- Issues: https://github.com/sk8011/notetake-ai-ultimate/issues
