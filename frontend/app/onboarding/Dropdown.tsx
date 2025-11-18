// Dropdown.js
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const Dropdown = ({ 
  placeholder,
  items,
  value,
  onSelect,
  zIndex 
}: {
  placeholder: string;
  items: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  zIndex: number;
}) => {
  const [open, setOpen] = useState(false);
  
  const handleSelect = (itemValue: string) => {
    onSelect(itemValue);
    setOpen(false);
  };

  const selectedItemLabel = items.find(item => item.value === value)?.label || placeholder;

  return (
    <View style={[styles.container, { zIndex: zIndex }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setOpen(!open)}
      >
        <Text style={styles.headerText}>{selectedItemLabel}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdown}>
          {items.map(item => (
            <TouchableOpacity
              key={item.value}
              style={styles.item}
              onPress={() => handleSelect(item.value)}
            >
              <Text style={styles.itemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  header: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  headerText: {
    fontSize: 16,
    color: '#16120f',
  },
  dropdown: {
    position: 'absolute',
    top: 56,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  itemText: {
    fontSize: 16,
    color: '#16120f',
  },
});

export default Dropdown;