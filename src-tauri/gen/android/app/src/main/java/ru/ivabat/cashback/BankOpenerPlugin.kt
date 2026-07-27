package ru.ivabat.cashback

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

/**
 * Запуск другого приложения по имени пакета.
 *
 * Зачем понадобилось. Раньше приложение банка открывалось ссылкой вида
 * "bank100000000004://" — это схема системы быстрых платежей. Банк принимал
 * такую ссылку за платёжный QR-код, не находил в нём реквизитов и показывал
 * ошибку: ВТБ писал «В этом QR-коде нет нужных реквизитов для платежа».
 * Человек в этот момент решает, что его пытаются обмануть.
 *
 * Правильно — просто запустить приложение, как с рабочего стола.
 * Из браузера так нельзя: Chrome разрешает открывать только те экраны,
 * которым разработчик явно позволил открываться из интернета. А нативному
 * коду это доступно — чем мы здесь и пользуемся.
 */
@InvokeArg
class LaunchArgs {
    lateinit var packageName: String
}

@TauriPlugin
class BankOpenerPlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun launchApp(invoke: Invoke) {
        val args = invoke.parseArgs(LaunchArgs::class.java)

        // Начиная с Android 11 приложение видит чужие пакеты, только если
        // перечислило их в манифесте — список собирается автоматически
        // из справочника банков. Если пакета там нет или приложение
        // не установлено, метод вернёт null.
        val intent = activity.packageManager.getLaunchIntentForPackage(args.packageName)

        if (intent == null) {
            invoke.reject("Приложение не установлено")
            return
        }

        activity.startActivity(intent)
        invoke.resolve(JSObject())
    }
}
