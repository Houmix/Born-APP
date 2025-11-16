import { useEffect, useState } from "react";
import { Text, View, StyleSheet, TextInput,TouchableOpacity } from "react-native";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage'; //AsyncStorage.setItem(clé,valeur) et .getItem(clé) pour stocker ou récupérer des données dans la sessions
import { useNavigation } from "expo-router";
export default function identificationScreen(){
    const navigation = useNavigation() //Pour la redirection (navigation.navigate("NomDeLaPage"))
    const [errorMessage, setErrorMessage] = useState("") //Pour afficher un message d'erreur
    const [phoneNumber, setPhoneNumber] = useState("") //Stock le num de tél

    //async pour executer la fonction de manière asyncrone cad lors du click ou de son appel
    //await permet d'attendre que la ligne fini son execution avant de passer à la suivante (utile quand on fait appel à une fonction)
    
    useEffect(() => {
        
    
    const clearAll = async () => {
        try {
          await AsyncStorage.clear();
          console.log("Tous les éléments de la session ont été supprimés");
        } catch (e) {
          console.error("Erreur lors de la suppression complète :", e);
        }
      };
      clearAll();
    }, []);
    const postCustomerToken = async () => { //Recupération du token du Customer 
        try {
            const response = await axios.post(`${POS_URL}/user/api/user/token/${phoneNumber}`) // Get car dans le back c'est du get + Num dans la requete car ce n'est pas une donnée semsible (dans urls, il y a un slug)
            return response.data.access
        } catch (error) {
            setErrorMessage("Utiisateur introuvable")
        }

    }
    // Fonction lors de la confirmation
    const handleSubmit = async () => { //Récupération des données de l'utilisateur
        try {
            const accessToken = await postCustomerToken() //Récupération du token
            const response = await axios.get(`${POS_URL}/user/api/getUser/${phoneNumber}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}` //Token inséré dans la requête
                }
            })
            
            if (response.status == 200){ //Enregistrement des données de l'utilisateur dans la session + Redirection
                AsyncStorage.setItem("token", accessToken)
                AsyncStorage.setItem("User_id", response.data.id)
                AsyncStorage.setItem("User_phone", response.data.phone)
                navigation.navigate("menu")
            } else {
                setErrorMessage("Utilisateur introuvable")
            }
        } catch (error) {
            console.error("Erreur lors de l'envoi du num", error)
            setErrorMessage("Erreur lors de la connexion")
        }
    }

    // Fonction ignore (Redirection vers la page des menu)
    const handleIgnore = async () => {
        navigation.navigate("menu")
    }

    return (
        <View style={styles.main}>
         <View style={styles.textBox}>
           {/* Titre */}
           <Text style={styles.title}>
             Entrez votre numéro :
           </Text>
           {errorMessage && <Text style={{ color: 'red', marginBottom: 10 }}>{errorMessage}</Text>}
        
           <TextInput
                style={styles.input}
                placeholder="Numéro de téléphone"
                keyboardType="numeric"
                value={phoneNumber}  // Lier la valeur du champ à l'état
                onChangeText={setPhoneNumber}  // Mettre à jour l'état lors de la saisie
            />
            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.txtBtn}>Confirmer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleIgnore}>
            <Text style={styles.txtBtn}>Ignorer</Text>
            </TouchableOpacity>
         </View>
    </View>
    )
   
}
const styles = StyleSheet.create({
    main: {
        flex:1,
        flexDirection:'column',
        display:"flex",
        justifyContent: "center",
        alignItems: "center"
        
    },
    textBox: {
        height:"20%",
        flexDirection:"column",
        display:"flex",
        justifyContent: "center",
        alignItems: 'center',
    },
    container: {
        height:"70%",
        flexDirection:"row",
        display:"flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20, // Espacement entre les boutons
        backgroundColor: "#f4f4f4",
    },
    box: {
        width: "100%",
        height: "100%",
        backgroundColor: "white",
        borderRadius: 15,
        display:"flex",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5, // Ombre pour Android
    },
    title: {
        color: "black",
        fontSize: 30,
        fontWeight: "bold",
        textDecorationLine:"underline",
    },
    text: {
        color: "black",
        fontSize: 30,
        fontWeight: "bold",
        textDecorationLine: "none", // Supprime le soulignement du lien
    },
    txtBtn: {
        color: "black",
        fontSize: 15,
        fontWeight: "bold",
        textDecorationLine: "none", // Supprime le soulignement du lien
    },
    input: {
        height: 60,
        margin: 12,
        borderWidth: 1,
        padding: 10,
        fontSize:20,
      },
      button: {
        backgroundColor: "white",
        margin: 10,
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5, // Ombre pour Android
      },
    
})