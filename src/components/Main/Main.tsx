import React, { useEffect, useState } from "react";
import styles from "./Main.module.css";

interface MainProps {
  nasaData: any;
}

const Main: React.FC<MainProps> = ({ nasaData }) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const centerX = window.innerWidth / 2; // Center X position
      const centerY = window.innerHeight / 2; // Center Y position

      // Calculate offsets based on mouse position relative to the center
      const xOffset = (clientX - centerX) * 0.025; // Adjust multiplier for sensitivity
      const yOffset = (clientY - centerY) * 0.025; // Adjust multiplier for sensitivity

      setOffset({ x: xOffset, y: yOffset });
    };

    // Add mousemove event listener
    window.addEventListener("mousemove", handleMouseMove);

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className={styles.imgContainer}>
      <img
        src={nasaData.hdurl}
        alt="NASA IMAGE"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`, // Apply translation
        }}
      />
    </div>
  );
};

export default Main;



// import styles from "./Main.module.css";

// interface MainProps {
//   nasaData: any;
// }

// const Main: React.FC<MainProps> = ({ nasaData }) => {
//   return (
//     <div className={styles.imgContainer}>
//       <img src={nasaData.hdurl} alt="NASA IMAGE" />
//     </div>
//   );
// };

// export default Main;
