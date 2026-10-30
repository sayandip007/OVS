import { METADATA_SOURCES } from '../utils/constants';

/**
 * All 28 Indian States and 8 Union Territories (36 total)
 * Using official current names.
 */
export const INITIAL_STATES = [
  // 28 States
  { id: 'AP', name: 'Andhra Pradesh', type: 'STATE', capital: 'Amaravati', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'AR', name: 'Arunachal Pradesh', type: 'STATE', capital: 'Itanagar', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'AS', name: 'Assam', type: 'STATE', capital: 'Dispur', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'BR', name: 'Bihar', type: 'STATE', capital: 'Patna', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'CG', name: 'Chhattisgarh', type: 'STATE', capital: 'Raipur', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'GA', name: 'Goa', type: 'STATE', capital: 'Panaji', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'GJ', name: 'Gujarat', type: 'STATE', capital: 'Gandhinagar', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'HR', name: 'Haryana', type: 'STATE', capital: 'Chandigarh', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'HP', name: 'Himachal Pradesh', type: 'STATE', capital: 'Shimla', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'JH', name: 'Jharkhand', type: 'STATE', capital: 'Ranchi', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'KA', name: 'Karnataka', type: 'STATE', capital: 'Bengaluru', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'KL', name: 'Kerala', type: 'STATE', capital: 'Thiruvananthapuram', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'MP', name: 'Madhya Pradesh', type: 'STATE', capital: 'Bhopal', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'MH', name: 'Maharashtra', type: 'STATE', capital: 'Mumbai', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'MN', name: 'Manipur', type: 'STATE', capital: 'Imphal', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'ML', name: 'Meghalaya', type: 'STATE', capital: 'Shillong', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'MZ', name: 'Mizoram', type: 'STATE', capital: 'Aizawl', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'NL', name: 'Nagaland', type: 'STATE', capital: 'Kohima', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'OD', name: 'Odisha', type: 'STATE', capital: 'Bhubaneswar', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'PB', name: 'Punjab', type: 'STATE', capital: 'Chandigarh', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'RJ', name: 'Rajasthan', type: 'STATE', capital: 'Jaipur', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'SK', name: 'Sikkim', type: 'STATE', capital: 'Gangtok', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'TN', name: 'Tamil Nadu', type: 'STATE', capital: 'Chennai', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'TG', name: 'Telangana', type: 'STATE', capital: 'Hyderabad', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'TR', name: 'Tripura', type: 'STATE', capital: 'Agartala', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'UP', name: 'Uttar Pradesh', type: 'STATE', capital: 'Lucknow', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'UK', name: 'Uttarakhand', type: 'STATE', capital: 'Dehradun', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'WB', name: 'West Bengal', type: 'STATE', capital: 'Kolkata', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },

  // 8 Union Territories
  { id: 'AN', name: 'Andaman and Nicobar Islands', type: 'UNION_TERRITORY', capital: 'Port Blair', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'CH', name: 'Chandigarh', type: 'UNION_TERRITORY', capital: 'Chandigarh', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu', type: 'UNION_TERRITORY', capital: 'Daman', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'DL', name: 'National Capital Territory of Delhi', type: 'UNION_TERRITORY', capital: 'New Delhi', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'JK', name: 'Jammu and Kashmir', type: 'UNION_TERRITORY', capital: 'Srinagar / Jammu', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'LA', name: 'Ladakh', type: 'UNION_TERRITORY', capital: 'Leh', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'LD', name: 'Lakshadweep', type: 'UNION_TERRITORY', capital: 'Kavaratti', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
  { id: 'PY', name: 'Puducherry', type: 'UNION_TERRITORY', capital: 'Puducherry', metadataSource: METADATA_SOURCES.VERIFIED_OFFICIAL },
];
