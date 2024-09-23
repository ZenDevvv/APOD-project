import styles from "./Sidebar.module.css";

interface SidebarProps {
  toggleSidebar: () => void; 
  nasaData: any;
  isSidebar: any;
}

const Sidebar: React.FC<SidebarProps> = ({ toggleSidebar, isSidebar, nasaData }) => {
  return (
    <div className={`${styles.container} ${isSidebar ? styles.active : ""}`}>
      <div className={styles.content}>
        <h1 className={styles.title}>{nasaData.title}</h1>
        <p className={styles.date}>{nasaData.date}</p>
        <p className={styles.description}>{nasaData.explanation}</p>
        <p className={styles.copyright}>&copy;{nasaData.copyright}</p>
      </div>
      <i
        onClick={toggleSidebar}
        className={`fa-solid fa-arrow-right ${styles.icon}`}
      ></i>
    </div>
  );
};

export default Sidebar;
