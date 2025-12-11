use sysinfo::{System, get_current_pid};
use std::fs::OpenOptions;
use std::io::Write;
use chrono::Local;
use colored::*;

pub async fn cpu_logger_task() {
    let mut sys = System::new_all();
    let pid = get_current_pid().expect("Impossibile recuperare il PID");

    let mut log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open("cpu_log.txt")
        .expect("Impossibile aprire il file di log della CPU");

    println!("{}", "Avvio del logger CPU Processo (ogni 2 minuti)...".yellow());
    
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(120)).await;
        sys.refresh_processes();
        
        if let Some(process) = sys.process(pid) {
            let usage = process.cpu_usage();
            let log_entry = format!("[{}] - CPU Backend: {:.4}%\n", Local::now().to_rfc3339(), usage);
            let _ = log_file.write_all(log_entry.as_bytes());
        }
    }
}