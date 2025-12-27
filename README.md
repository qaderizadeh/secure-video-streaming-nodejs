# Secure Video Streaming (Node.js + HTML5)

A demo project showcasing a secure video streaming setup with:

- **Node.js backend** (Express)
  - Authorization header validation
  - HTTP Range request support
  - Throttled seeking (delays on large jumps to slow automated downloads)
  - Anti-download headers

- **HTML5 frontend**
  - Video player with Authorization header injection
  - Simple UI for token input and playback

---

## 🚀 Features

- 🔒 **Authorization**: Backend validates `Authorization` header or signed token.
- 📼 **Streaming**: Supports partial content via HTTP Range requests.
- ⏱️ **Throttling**: Introduces delay when seeking far ahead to discourage bulk downloaders.
- 🛡️ **Security headers**: Prevents trivial downloads and caching.

---

## 📂 Project Structure

```
secure-video-streaming-nodejs/
├── server.js          # Express backend
├── videos/            # Sample video files (e.g., sample.mp4)
└── public/
    ├── index.html     # HTML5 video player
    └── sw.js          # Service Worker for Authorization header injection
```

---

## ⚙️ Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/qaderizadeh/secure-video-streaming-nodejs.git
   cd secure-video-streaming-nodejs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add a sample video**
   Place `sample.mp4` inside the `videos/` directory.

4. **Run the server**
   ```bash
   node server.js
   ```

5. **Open the player**
   Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔧 Configuration

- **Delay factor**: Adjust `DELAY_MS_PER_SECOND_JUMP` in `server.js` to tune throttling.
- **Auth validation**: Replace the demo token check with JWT or HMAC validation.
- **Bitrate estimation**: Integrate `ffprobe` for accurate bitrate calculation.

---

## 📜 License

MIT License. Free to use and adapt.
