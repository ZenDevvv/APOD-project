import styles from "./Title.module.css";

interface TitleProps {
  toggleSidebar: () => void; 
  nasaData: any; // Replace 'any' with a more specific type if you know the structure
}

const Title: React.FC<TitleProps> = ({ toggleSidebar, nasaData }) => {
  return (
    <div className={styles.container}>
      <div className={styles.title}>
        <h2>APOD PROJECT</h2>
        <h1>{nasaData.title}</h1>
      </div>
      <i
        onClick={toggleSidebar}
        className={`fa-solid fa-circle-info ${styles.icon}`}
      ></i>
    </div>
  );
};

export default Title;
