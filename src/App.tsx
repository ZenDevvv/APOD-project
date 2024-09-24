import Main from "./components/Main/Main";
import Sidebar from "./components/Sidebar/Sidebar";
import Title from "./components/Title/Title";
import "./App.css";
import { useEffect, useState } from "react";

function App() {
  const [isSidebar, setIsSidebar] = useState(false);
  const [nasaData, setNasaData] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const API_KEY = import.meta.env.VITE_API_KEY;
      const today = new Date().toISOString().slice(0, 10);
      const url = `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}`;

      // local storage for preventing unnecessary API calls
      const localKey = `NASA-${today}`;
      const cachedData = localStorage.getItem('NASA-bday') || localStorage.getItem(localKey)

      if (cachedData){
        const data = JSON.parse(cachedData);
        setNasaData(data);
        console.log('Fetched from cache today')
        setIsLoading(false);
        return;
      }
      localStorage.clear()

      try {
        const res = await fetch(url);
        const data = await res.json();
        localStorage.setItem(localKey, JSON.stringify(data));
        setNasaData(data);
        setIsLoading(false);
        console.log('Fetched from API today')
      } catch (err) {
        console.log(err);
      }
    };

    fetchData();
  }, []);

  const toggleSidebar = () => {
    setIsSidebar(!isSidebar);
  };

  return !isLoading ? (
    <div className="app-container">
      <Main nasaData={nasaData} />
      <Sidebar
        nasaData={nasaData}
        toggleSidebar={toggleSidebar}
        isSidebar={isSidebar}
        setNasaData={setNasaData}
      />
      <Title nasaData={nasaData} toggleSidebar={toggleSidebar} />
    </div>
  ) : (
    <div className="loading">
      <i className="fa-solid fa-gear"></i>
    </div>
  );
}

export default App;
