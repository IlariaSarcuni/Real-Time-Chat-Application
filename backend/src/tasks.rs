use sysinfo::{System, get_current_pid}; 
use std::fs::OpenOptions;
use std::io::Write;
use chrono::Local;
use colored::*;
use tokio::time::{sleep, Duration};

pub async fn cpu_logger_task() {
    // Inizializziamo il sistema
    let mut sys = System::new_all();
    let pid = get_current_pid().expect("Impossibile recuperare il PID");

    println!("{}", "Avvio del logger CPU Backend (ogni 2 minuti)...".yellow());
    
    loop {
        // Aspetta 120 secondi
        sleep(Duration::from_secs(120)).await;

        sys.refresh_all(); 
        
        if let Some(process) = sys.process(pid) {
            let usage = process.cpu_usage();
            let run_time = process.run_time(); 
            
            let timestamp = Local::now().format("%d-%m-%Y %H:%M:%S").to_string();
            let log_entry = format!(
                "[{}] CPU Usage: {:.2}% | Total Run Time: {}s\n",
                timestamp, usage, run_time
            );

            // Scrittura su file
            let res = OpenOptions::new()
                .create(true)
                .append(true)
                .open("cpu_log.txt");

            if let Ok(mut file) = res {
                let _ = file.write_all(log_entry.as_bytes());
            }
        }
    }
}