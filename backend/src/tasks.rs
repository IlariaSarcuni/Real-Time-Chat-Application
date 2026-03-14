use colored::*;
use chrono::Local;
use std::io::Write;
use std::fs::OpenOptions;
use tokio::time::{sleep, Duration};
use sysinfo::{System, get_current_pid}; 

/// Monitoraggio periodico delle risorse. 
/// 
/// Ogni 120 secondi, la funzione campiona:
/// - **CPU usage**: Percentuale di utilizzo della CPU (somma dei core).
/// - **Runtime**: Tempo totale trascorso dall'avvio del processo (in secondi).
/// 
/// I dati vengono salvati in modalità append nel file `cpu_log.txt`.
pub async fn cpu_logger_task() {
    
    let mut sys = System::new_all();
    let pid = get_current_pid().expect("Impossibile recuperare il PID corrente.");

    println!("{}", "Avvio del logger CPU Backend (ogni 2 minuti)...".yellow());
    println!("{} {}", "Sistema operativo:".cyan(), System::name().unwrap_or("Unknown".to_string()));
    println!("{} {}", "Versione kernel:  ".cyan(), System::kernel_version().unwrap_or("Unknown".to_string()));
    println!("{} {}", "Core Logici:      ".cyan(), sys.cpus().len());
    println!("{} {}", "Architettura:     ".cyan(), System::cpu_arch().unwrap_or("Unknown".to_string()));
    println!("--------------------------------------------------");
    
    loop {
        
        sleep(Duration::from_secs(120)).await;

        sys.refresh_all();
        
        if let Some(process) = sys.process(pid) {
            let usage = process.cpu_usage();
            let run_time = process.run_time();
            let num_cpus = sys.cpus().len();
            
            let timestamp = Local::now().format("%d-%m-%Y %H:%M:%S").to_string();
            let log_entry = format!(
                "[{}] CPU Usage: {:.2}% | Runtime: {}s | Cores: {}\n",
                timestamp, usage, run_time, num_cpus
            );

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