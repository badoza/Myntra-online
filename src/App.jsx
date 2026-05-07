import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import { User, Navigation, Map as MapIcon } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon issue
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/');

// Helper to auto-center map when a user is selected
function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => { if (coords) map.setView([coords.lat, coords.lng], 16); }, [coords]);
  return null;
}

export default function App() {
  const [userName, setUserName] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    socket.on('users-list', (data) => setUsers(data));
    return () => socket.off('users-list');
  }, []);

  const startSharing = () => {
    if (!userName) return alert("Enter your name first!");
    setIsSharing(true);
    
    navigator.geolocation.watchPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      socket.emit('update-location', { name: userName, lat: latitude, lng: longitude });
    }, (err) => console.error(err), { enableHighAccuracy: true });
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-slate-800 border-r border-slate-700 p-4 flex flex-col gap-4 shadow-xl z-[1000]">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Navigation className="text-blue-400" /> Live Tracker
        </h1>
        
        {!isSharing ? (
          <div className="space-y-3">
            <input 
              className="w-full p-2 rounded bg-slate-700 border border-slate-600 outline-none focus:border-blue-500"
              placeholder="Your Name..."
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
            <button onClick={startSharing} className="w-full bg-blue-600 hover:bg-blue-500 p-2 rounded font-semibold transition">
              Start Sharing My Location
            </button>
          </div>
        ) : (
          <div className="p-2 bg-green-900/30 text-green-400 rounded text-sm">
            Status: Sharing as <strong>{userName}</strong>
          </div>
        )}

        <div className="flex-1 overflow-y-auto mt-4">
          <p className="text-xs uppercase text-slate-500 font-bold mb-2">Active Users</p>
          {users.map(u => (
            <div 
              key={u.id} 
              onClick={() => setSelectedUser(u)}
              className={`p-3 rounded-lg mb-2 cursor-pointer flex items-center gap-3 transition ${selectedUser?.id === u.id ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              <div className="bg-slate-800 p-2 rounded-full"><User size={16}/></div>
              <div>
                <p className="font-medium">{u.name} {u.id === socket.id && "(You)"}</p>
                <p className="text-xs opacity-70">Live Now</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        <MapContainer center={[20.5937, 78.9629]} zoom={5} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {users.map(u => (
            <Marker key={u.id} position={[u.lat, u.lng]}>
              <Popup>{u.name}</Popup>
            </Marker>
          ))}
          {selectedUser && <RecenterMap coords={selectedUser} />}
        </MapContainer>
      </div>
    </div>
  );
}
