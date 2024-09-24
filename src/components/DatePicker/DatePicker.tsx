import React, { useState } from "react";
import styles from "./DatePicker.module.css";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface DatePickerProps {
  setNasaData: (data: any) => void; // Replace 'any' with the actual type of your NASA data
}

const DatePicker: React.FC<DatePickerProps> = ({ setNasaData }) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const minDate = new Date("1995-06-20");
  //Yesterday date
  const maxDate = new Date(new Date().setDate(new Date().getDate() - 1));

  const handleDate = (date: Date | null) => {
    setSelectedDate(date);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return ""; // Return an empty string if the date is null
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchDateApod = async () => {
    console.log(selectedDate);
    const API_KEY = import.meta.env.VITE_API_KEY;
    const formattedDate = formatDate(selectedDate);
    const url = `https://api.nasa.gov/planetary/apod?date=${formattedDate}&api_key=${API_KEY}`;

    const cachedData = localStorage.getItem("NASA-bday");
    if (cachedData) {
      const data = JSON.parse(cachedData);
      setNasaData(data);
      console.log("Fetched from cache today");
      return;
    }

    try {
      if (selectedDate) {
        const localKey = "NASA-bday";
        const res = await fetch(url);
        const data = await res.json();
        setNasaData(data);
        localStorage.setItem(localKey, JSON.stringify(data));
      }
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.birthday}>
        Want to know the Astronomy Picture of your birthday? Enter the date below and find out!
      </h2>
      <ReactDatePicker
        className={styles.calendar}
        selected={selectedDate}
        onChange={handleDate}
        dateFormat="yyyy-MM-dd"
        placeholderText="YYYY-MM-DD"
        minDate={minDate}
        maxDate={maxDate}
      />
      <button onClick={fetchDateApod} className={styles.submitBtn}>
        Submit
      </button>
    </div>
  );
};

export default DatePicker;
