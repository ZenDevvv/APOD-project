import styles from "./Title.module.css";

interface TitleProps {
  toggleSidebar: () => void;
  nasaData: any; // Replace 'any' with a more specific type if you know the structure
}

 const deleteNasaBday = () => {
  localStorage.removeItem('NASA-bday');
  window.location.reload();

 }

const Title: React.FC<TitleProps> = ({ toggleSidebar, nasaData }) => {
  return (
    <div className={styles.container}>
      <div className={styles.title}>
        {localStorage.getItem("NASA-bday") ? (
          <h2>Astronomy Picture of your Birthday:</h2>
        ) : (
          <h2>Astronomy Picture of the Day:</h2>
        )}
        <div className={styles.apod}>
          <h1>{nasaData.title}</h1>
          {localStorage.getItem("NASA-bday") && (
            <button onClick={deleteNasaBday}>Go back to APOD</button>
          )}
        </div>
      </div>

      <div className={styles.btnContainer}>
        <i
          onClick={toggleSidebar}
          className={`fa-solid fa-circle-info ${styles.icon}`}
        ></i>
        <a href={nasaData.hdurl}>
          <i className={`fa-solid fa-expand ${styles.expand}`}></i>
        </a>
      </div>
    </div>
  );
};

export default Title;
