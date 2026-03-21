/**
 * utils/orderQueue.ts
 * File d'attente persistante pour les commandes en cas de serveur indisponible.
 * Les commandes sont sauvegardées dans AsyncStorage et renvoyées dès que
 * le serveur répond.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'born_order_queue';

export interface QueuedOrder {
    id: string;               // identifiant local unique
    paymentMethod: number;    // 0 = espèces, 1 = carte
    data: Record<string, any>;// payload createOrder
    token: string;            // JWT au moment de la mise en file
    createdAt: string;        // ISO
    retries: number;
}

export async function enqueueOrder(
    paymentMethod: number,
    data: Record<string, any>,
    token: string
): Promise<string> {
    const queue = await loadQueue();
    const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    queue.push({ id, paymentMethod, data, token, createdAt: new Date().toISOString(), retries: 0 });
    await saveQueue(queue);
    console.log(`[OrderQueue] Commande mise en file (${queue.length} en attente) id=${id}`);
    return id;
}

export async function getQueueSize(): Promise<number> {
    const q = await loadQueue();
    return q.length;
}

export async function loadQueue(): Promise<QueuedOrder[]> {
    try {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function saveQueue(queue: QueuedOrder[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Tente d'envoyer toutes les commandes en file d'attente.
 * Retourne le nombre de commandes traitées avec succès.
 */
export async function processQueue(posUrl: string): Promise<number> {
    const queue = await loadQueue();
    if (queue.length === 0) return 0;

    console.log(`[OrderQueue] Traitement de ${queue.length} commande(s) en attente...`);
    const remaining: QueuedOrder[] = [];
    let successCount = 0;

    for (const order of queue) {
        try {
            const response = await fetch(
                `${posUrl}/order/api/createOrder/${order.paymentMethod}/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${order.token}`,
                    },
                    body: JSON.stringify(order.data),
                }
            );
            if (response.ok || response.status === 201) {
                console.log(`[OrderQueue] ✅ Commande ${order.id} envoyée avec succès`);
                successCount++;
            } else {
                // Erreur serveur (4xx/5xx) : on abandonne cette commande après 5 essais
                order.retries += 1;
                if (order.retries < 5) {
                    remaining.push(order);
                } else {
                    console.warn(`[OrderQueue] ⚠️ Commande ${order.id} abandonnée après ${order.retries} essais`);
                }
            }
        } catch {
            // Réseau toujours indisponible → garder en file
            remaining.push(order);
            break; // inutile de continuer si le réseau est mort
        }
    }

    await saveQueue(remaining);
    if (successCount > 0) {
        console.log(`[OrderQueue] ${successCount} commande(s) traitée(s), ${remaining.length} restante(s)`);
    }
    return successCount;
}
