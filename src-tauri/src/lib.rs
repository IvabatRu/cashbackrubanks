use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

/// Имя пакета Android-приложения — оно же идентификатор нашего плагина
/// на стороне Kotlin.
#[cfg(target_os = "android")]
const ANDROID_PLUGIN_IDENTIFIER: &str = "ru.ivabat.cashback";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchArgs {
    package_name: String,
}

/// Ручка плагина на Kotlin. Храним её в состоянии приложения, чтобы
/// команда ниже могла до неё дотянуться.
#[cfg(target_os = "android")]
struct BankOpener<R: Runtime>(tauri::plugin::PluginHandle<R>);

/// Запускает приложение банка так же, как это делает нажатие на его значок
/// на рабочем столе.
///
/// Раньше вместо запуска открывалась ссылка со схемой системы быстрых
/// платежей, и банк принимал её за платёжный QR-код без реквизитов.
#[tauri::command]
fn launch_app<R: Runtime>(app: AppHandle<R>, package_name: String) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let opener = app.state::<BankOpener<R>>();
        // Ответ разбираем как произвольное значение и выбрасываем.
        // Код на Kotlin возвращает пустой объект, и если ожидать здесь
        // «ничего», разбор падает с «invalid type: map, expected unit» —
        // уже после того, как приложение успешно открылось.
        opener
            .0
            .run_mobile_plugin::<serde_json::Value>("launchApp", LaunchArgs { package_name })
            .map(|_| ())
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    {
        // На компьютере запускать приложение банка нечего и незачем
        let _ = (app, package_name);
        Err("Запуск приложений доступен только на Android".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Плагин нужен только для того, чтобы получить ручку к коду на Kotlin:
        // зарегистрировать его можно лишь изнутри плагина.
        .plugin(
            tauri::plugin::Builder::new("bankopener")
                // Тип настроек плагина указан явно: настроек у нас нет,
                // а вывести его самостоятельно компилятор не может.
                .setup(|_app, _api: tauri::plugin::PluginApi<_, ()>| {
                    #[cfg(target_os = "android")]
                    {
                        let handle = _api
                            .register_android_plugin(ANDROID_PLUGIN_IDENTIFIER, "BankOpenerPlugin")?;
                        _app.manage(BankOpener(handle));
                    }
                    Ok(())
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![launch_app])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
