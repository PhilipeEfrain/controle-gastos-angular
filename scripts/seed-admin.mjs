#!/usr/bin/env node

/**
 * Script de provisionamento de usuário Administrador para o Firebase Emulator Suite
 * 
 * Uso:
 *   npm run seed:admin
 *   npm run seed:admin -- --email=outro@quinzena.local --password=outrasenha
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import http from 'node:http';

// Configuração das portas e hosts dos emuladores
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'controle-gastos-app-36264';

process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.NO_GCE_CHECK = 'true';
process.env.GOOGLE_AUTH_SUPPRESS_CREDENTIALS_WARNINGS = 'true';

// Parse simples de argumentos da linha de comando
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    email: 'admin@quinzena.local',
    password: 'admin123',
    name: 'Administrador (Dev)',
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--email=')) {
      options.email = arg.split('=')[1];
    } else if (arg.startsWith('--password=')) {
      options.password = arg.split('=')[1];
    } else if (arg.startsWith('--name=')) {
      options.name = arg.split('=')[1];
    }
  }

  return options;
}

// Verifica se uma porta HTTP está respondendo
function checkService(hostPort) {
  return new Promise((resolve) => {
    const [host, port] = hostPort.split(':');
    const req = http.request({ host, port: Number(port), method: 'GET', path: '/' }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    console.log(`
Provisionador de Administrador para o Firebase Emulator Suite
============================================================

Uso:
  npm run seed:admin
  npm run seed:admin -- --email=<email> --password=<senha> --name="<nome>"

Parâmetros opcionais:
  --email=<email>       E-mail do administrador (padrão: admin@quinzena.local)
  --password=<senha>    Senha de acesso (padrão: admin123)
  --name="<nome>"       Nome de exibição (padrão: Administrador (Dev))
  --help, -h            Exibe esta mensagem de ajuda
`);
    process.exit(0);
  }

  console.log('🔧 Verificando status dos emuladores do Firebase...');
  const [authAlive, firestoreAlive] = await Promise.all([
    checkService(AUTH_EMULATOR_HOST),
    checkService(FIRESTORE_EMULATOR_HOST)
  ]);

  if (!authAlive || !firestoreAlive) {
    console.error(`
❌ ERRO: Os emuladores do Firebase não estão respondendo!
   - Auth Emulator (${AUTH_EMULATOR_HOST}): ${authAlive ? '✅ ONLINE' : '❌ OFFLINE'}
   - Firestore Emulator (${FIRESTORE_EMULATOR_HOST}): ${firestoreAlive ? '✅ ONLINE' : '❌ OFFLINE'}

Certifique-se de iniciar os emuladores em outro terminal antes de executar este script:
   npm run emulators
`);
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ projectId: PROJECT_ID });
  }

  const auth = getAuth();
  const db = getFirestore();

  console.log(`👤 Criando/configurando usuário Admin (${options.email})...`);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(options.email);
    console.log(`ℹ️  Usuário existente encontrado no Auth (UID: ${userRecord.uid}). Atualizando credenciais...`);
    userRecord = await auth.updateUser(userRecord.uid, {
      password: options.password,
      displayName: options.name,
      emailVerified: true
    });
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log(`➕ Criando novo usuário no Auth Emulator...`);
      userRecord = await auth.createUser({
        email: options.email,
        password: options.password,
        displayName: options.name,
        emailVerified: true
      });
    } else {
      throw error;
    }
  }

  // 1. Define Custom Claims { admin: true } no Firebase Auth
  console.log('🛡️  Atribuindo Custom Claims { admin: true } no Firebase Auth...');
  await auth.setCustomUserClaims(userRecord.uid, { admin: true });

  // 2. Cria ou atualiza o perfil em users/{uid} no Firestore
  console.log('📄 Gravando documento do usuário com role="admin" no Firestore...');
  const userDocRef = db.collection('users').doc(userRecord.uid);
  const now = new Date().toISOString();

  await userDocRef.set({
    uid: userRecord.uid,
    email: options.email,
    displayName: options.name,
    photoURL: null,
    role: 'admin',
    plan: 'pro',
    planStatus: 'active',
    preferences: {
      theme: 'dark',
      currency: 'BRL'
    },
    updatedAt: now,
    createdAt: now
  }, { merge: true });

  console.log(`
============================================================
🎉 Usuário Administrador configurado com sucesso no Emulador!
============================================================
📧 E-mail:       ${options.email}
🔑 Senha:        ${options.password}
🏷️  Nome:         ${options.name}
🆔 UID:          ${userRecord.uid}
👑 Role:         admin
⭐ Plano:        pro (Ativo)
🛡️  Custom Claim: { admin: true }
📂 Firestore:    users/${userRecord.uid}

Como testar no Quinzena App:
1. Abra a aplicação local (ex: http://localhost:4200/auth)
2. Faça login com o e-mail e a senha acima
3. Acesse o menu de administração em /admin
============================================================
`);
}

main().catch((err) => {
  console.error('❌ Erro inesperado ao provisionar administrador:', err);
  process.exit(1);
});
