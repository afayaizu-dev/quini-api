import * as usuariosRepository from "../usuarios/usuarios.repository.js";
import { sendMail } from "../mail/gmail.js";
import type { EnviarBoletinResponse } from "./boletin.schemas.js";

const CONCURRENCIA_ENVIO = 5;

export async function enviarBoletin(subject: string, html: string): Promise<EnviarBoletinResponse> {
    const usuarios = await usuariosRepository.findAll();
    const fallidos: string[] = [];
    let siguiente = 0;

    async function worker(): Promise<void> {
        for (let usuario = usuarios[siguiente++]; usuario; usuario = usuarios[siguiente++]) {
            try {
                await sendMail({ to: usuario.email, subject, html });
            } catch (error) {
                console.error(`Boletín: fallo al enviar a ${usuario.email}:`, error);
                fallidos.push(usuario.email);
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCIA_ENVIO, usuarios.length) }, worker));

    return { enviados: usuarios.length - fallidos.length, fallidos };
}
