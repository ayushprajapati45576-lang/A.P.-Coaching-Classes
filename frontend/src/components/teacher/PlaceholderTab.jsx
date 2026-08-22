import React from 'react';
import styles from './Tabs.module.css';

const PlaceholderTab = ({ title, description }) => (
    <div className={`glass-panel ${styles.tabContainer} animate-fade-in`}>
        <h2>{title}</h2>
        <p className={styles.placeholderText}>{description}</p>
    </div>
);

export default PlaceholderTab;
