import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { POS_URL, idRestaurant } from "@/config";
import { useEffect } from "react";

export default function IndexScreen() {
  const router = useRouter();


  // Fonction pour récupérer le token
  const getToken = async () => {
    try {
      const response = await axios.post(`${POS_URL}/user/api/user/token/0`) // Get car dans le back c'est du get + Num dans la requete car ce n'est pas une donnée semsible (dans urls, il y a un slug)
      if (response.status == 200 || response.status == 201) {
        console.log(response);
        AsyncStorage.setItem("token",response.data.access);
        console.log("token stored");
        console.log(response.data.access);
      } else {
        console.log("bad");
      }
    } catch (error) {
      console.log("Erreur dans getToken:", error);
    }
  };

  // Exécuté au chargement de la page
  useEffect(() => {
    getToken();
  }, []);
  return (
    <View style={styles.main}>
      

      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.box} 
          onPress={() => router.push("/(tabs)/identification")}
        >
          <Text style={styles.text}>S'identifier</Text>
          <MaterialIcons name="perm-identity" size={400} color="black" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.box} 
          onPress={() => router.push("/(tabs)/menu")}
        ><Text style={styles.text}>Commander</Text>
          <Ionicons name="fast-food" size={400} color="black" />
        </TouchableOpacity>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
    main: {
        flex: 1,
        flexDirection: 'column',
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white", // Ajout de la couleur de fond blanche
    },
    textBox: {
        height: "20%",
        flexDirection: "row",
        display: "flex",
        justifyContent: "center",
        alignItems: 'center',
    },
    container: {
        height: "70%",
        width: "45%",
        flexDirection: "row",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20, // Espacement entre les boutons
        backgroundColor: "white",
    },
    box: {
        width: "100%",
        height: "100%",
        backgroundColor: "white",
        borderRadius: 15,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        borderBlockColor: "black",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
        elevation: 5, // Ombre pour Android
    },
    title: {
        color: "black",
        fontSize: 30,
        fontWeight: "bold",
        textDecorationLine: "underline",
    },
    text: {
        color: "black",
        fontSize: 30,
        fontWeight: "bold",
        textDecorationLine: "none", // Supprime le soulignement du lien
    },
});
