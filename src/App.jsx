import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import { User, Navigation, ShieldCheck, Share2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet Icons
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/');

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => { if (coords) map.setView([coords.lat, coords.lng], 16); }, [coords]);
  return null;
}

export default function App() {
  const [role, setRole] = useState('user'); // 'user' or 'admin'
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [userId] = useState(localStorage.getItem('userId') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [isSharing, setIsSharing] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    // Save userId to prevent data loss on refresh
    localStorage.setItem('userId', userId);
    
    // Check if URL contains "/admin"
    if (window.location.pathname.includes('/admin')) {
      setRole('admin');
    }

    socket.on('users-list', (data) => setUsers(data));
    return () => socket.off('users-list');
  }, [userId]);

  const startSharing = () => {
    if (!userName) return alert("Please enter your name");
    localStorage.setItem('userName', userName);
    setIsSharing(true);
    
    navigator.geolocation.watchPosition((pos) => {
      socket.emit('update-location', { 
        userId, 
        name: userName, 
        lat: pos.coords.latitude, 
        lng: pos.coords.longitude 
      });
    }, (err) => console.error(err), { enableHighAccuracy: true });
  };

  // --- ADMIN VIEW ---
  if (role === 'admin') {
    return (
      <div className="flex h-screen w-full bg-slate-900 text-white">
        <div className="w-80 bg-slate-800 border-r border-slate-700 p-4 flex flex-col z-[1000]">
          <h1 className="text-xl font-bold flex items-center gap-2 mb-6">
            <ShieldCheck className="text-red-400" /> Admin Portal
          </h1>
          <div className="flex-1 overflow-y-auto">
            <p className="text-xs uppercase text-slate-500 font-bold mb-4">Live Tracking ({users.length})</p>
            {users.map(u => (
              <div 
                key={u.userId} 
                onClick={() => setSelectedUser(u)}
                className={`p-3 rounded-lg mb-2 cursor-pointer flex items-center gap-3 transition ${selectedUser?.userId === u.userId ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
              >
                <div className="bg-slate-800 p-2 rounded-full"><User size={16}/></div>
                <div>
                  <p className="font-medium text-sm">{u.name}</p>
                  <p className="text-[10px] opacity-60">ID: {u.userId}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <MapContainer center={[20.5937, 78.9629]} zoom={5} className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {users.map(u => (
              <Marker key={u.userId} position={[u.lat, u.lng]}>
                <Popup className="text-black"><b>{u.name}</b><br/>User is active</Popup>
              </Marker>
            ))}
            {selectedUser && <RecenterMap coords={selectedUser} />}
          </MapContainer>
        </div>
      </div>
    );
  }

  // --- USER VIEW (ONLY SHARING) ---
  return (
    <div className="h-screen w-full bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700 text-center">
        <div className="bg-blue-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Navigation className="text-blue-500 w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Location Sharer</h1>
        <p className="text-slate-400 mb-8 text-sm">Your location will only be visible to the system administrator.</p>

        {!isSharing ? (
          <div className="space-y-4">
            <input 
              className="w-full p-4 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-blue-500 transition"
              placeholder="Enter your full name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
            <button 
              onClick={startSharing}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition transform active:scale-95"
            >
              <Share2 size={20} /> Start Live Sharing
            </button>
          </div>
        ) : (
          <div className="py-6 px-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div className="animate-pulse flex items-center justify-center gap-2 text-green-400 font-bold mb-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              LIVE SHARING ACTIVE
            </div>
            <p className="text-xs text-green-500/60 uppercase">Sharing as {userName}</p>
          </div>
        )}
        
        <p className="mt-8 text-[10px] text-slate-600 uppercase tracking-widest">Secure Emergency Tracking System</p>
      </div>
    </div>
  );
}
