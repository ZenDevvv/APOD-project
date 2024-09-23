import styles from "./Main.module.css";

interface MainProps {
  nasaData: any;
}

const Main: React.FC<MainProps> = ({ nasaData }) => {
  return (
    <div className={styles.imgContainer}>
      <img src={nasaData.hdurl} alt="NASA IMAGE" />
    </div>
  );
};

export default Main;
