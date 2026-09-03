import { useState, useEffect } from 'react';
import apiClient from './api/client';

function App() {
  const [dbTime, setDbTime] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/test-db')
      .then((response) => {
        setDbTime(response.data.dbTime.now);
      })
      .catch((error) => {
        console.error('Failed to reach backend:', error);
      });
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Library Rental System</h1>
      <p>Backend connection test: {dbTime ? dbTime : 'Loading...'}</p>
    </div>
  );
}

export default App;