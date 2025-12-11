HSE Backend (Express) — quick start
1. Place parts 1..5 into files in a folder.
   - server.js (Part 2)
   - routes_mods.js (Part 3 & 4 combined as described) or use the parts exactly as given to create files
   - helpers & data folder etc.
2. Install:
   npm install
3. Run:
   node server.js
4. The API base will be:
   http://localhost:8000/api
   (If you want to use your LAN IP 192.168.29.149:8000, run on that host machine or set host when starting.)
5. Uploads are available under /uploads (served statically).
6. Data files are saved under ./data/*.json automatically.

API summary (all modules use id-based routes):
GET    /api/<module>
POST   /api/<module>
PUT    /api/<module>/:id
DELETE /api/<module>/:id

Special:
- POST /api/policies  (multipart/form-data) — returns { id, url, title, ... }
- POST /api/gallery   (multipart/form-data) — returns { id, url }
- POST /api/visitors  (multipart/form-data allowed)
- PUT  /api/factories expects full array payload (frontend uses PUT /api/factories with array)
- POST /api/auth/login {username, password} -> { token, user }

