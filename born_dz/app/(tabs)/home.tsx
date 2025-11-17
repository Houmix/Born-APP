import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { POS_URL } from "@/config";
export default function HomeScreen() {
  return (
    <View style={styles.main}>
        <View style={styles.container2}>
            
        </View>
        
        <View style={styles.container}>
                
            {/* Bouton S'identifier */}
            <TouchableOpacity style={styles.box}>
            </TouchableOpacity>

            {/* Bouton Commander */}
            <TouchableOpacity style={styles.box}>
                <Text></Text>
            </TouchableOpacity>
        </View>
    </View>
    
  );
}

const styles = StyleSheet.create({

    main: {
        flex:1,
        flexDirection:'column',
        display:"flex",
        justifyContent: "center",
        alignItems: "center",
        
    },
    container2: {
        height:"20%",
        flexDirection:"row",
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
    text2: {
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
});
