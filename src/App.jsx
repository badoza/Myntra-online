// inside App.jsx

useEffect(() => {
  // ... (previous setup logic)

  const startAutoTracking = () => {
    // Request Wake Lock to keep the connection alive
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').catch(() => {});
    }

    const options = {
      enableHighAccuracy: true, // Forces GPS instead of Wi-Fi (More accurate)
      maximumAge: 0,            // No cached locations
      timeout: 10000            // Don't wait forever
    };

    navigator.geolocation.watchPosition((pos) => {
      const { latitude, longitude, heading, speed } = pos.coords;
      
      socket.emit('update-location', { 
        userId, 
        name: urlName, 
        lat: latitude, 
        lng: longitude,
        heading: heading, // Helps with rotation if we add an arrow icon
        speed: speed 
      });
    }, (err) => {
      console.warn("GPS Signal Lost - Retrying...");
    }, options);
  };

  if (role === 'user') startAutoTracking();
}, [role]);

// Update the Marker in Admin View to use a "Transition" effect
// In your Marker loop:
{users.map(u => (
  <Marker 
    key={u.userId} 
    position={[u.lat, u.lng]}
    // This makes the icon move smoothly instead of jumping
    eventHandlers={{
        add: (e) => {
            e.target.getElement().style.transition = "all 1s linear";
        }
    }}
  >
    <Popup>{u.name} - Moving at {u.speed ? (u.speed * 3.6).toFixed(1) : 0} km/h</Popup>
  </Marker>
))}
