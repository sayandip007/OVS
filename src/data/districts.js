import { METADATA_SOURCES } from '../utils/constants';

/**
 * Sample Districts across all 36 Indian States and Union Territories (2 per State/UT = 72 districts).
 * Clearly labelled with metadataSource: DEMO_SAMPLE.
 */
export const INITIAL_DISTRICTS = [
  // West Bengal (WB)
  { id: 'NADIA', name: 'Nadia', stateId: 'WB', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'WB-DIST-KOLKATA', name: 'Kolkata', stateId: 'WB', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // NCT of Delhi (DL)
  { id: 'DL-DIST-NEW-DELHI', name: 'New Delhi', stateId: 'DL', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'DL-DIST-NORTH-DELHI', name: 'North Delhi', stateId: 'DL', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Uttar Pradesh (UP)
  { id: 'UP-DIST-VARANASI', name: 'Varanasi', stateId: 'UP', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'UP-DIST-LUCKNOW', name: 'Lucknow', stateId: 'UP', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Maharashtra (MH)
  { id: 'MH-DIST-MUMBAI-SUBURBAN', name: 'Mumbai Suburban', stateId: 'MH', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'MH-DIST-PUNE', name: 'Pune', stateId: 'MH', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Bihar (BR)
  { id: 'BR-DIST-PATNA', name: 'Patna', stateId: 'BR', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'BR-DIST-NALANDA', name: 'Nalanda', stateId: 'BR', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Andhra Pradesh (AP)
  { id: 'AP-DIST-GUNTUR', name: 'Guntur', stateId: 'AP', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'AP-DIST-VISAKHAPATNAM', name: 'Visakhapatnam', stateId: 'AP', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Kerala (KL)
  { id: 'KL-DIST-WAYANAD', name: 'Wayanad', stateId: 'KL', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'KL-DIST-THIRUVANANTHAPURAM', name: 'Thiruvananthapuram', stateId: 'KL', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Tamil Nadu (TN)
  { id: 'TN-DIST-CHENNAI', name: 'Chennai', stateId: 'TN', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'TN-DIST-COIMBATORE', name: 'Coimbatore', stateId: 'TN', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Karnataka (KA)
  { id: 'KA-DIST-BENGALURU-URBAN', name: 'Bengaluru Urban', stateId: 'KA', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'KA-DIST-MYSURU', name: 'Mysuru', stateId: 'KA', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Gujarat (GJ)
  { id: 'GJ-DIST-AHMEDABAD', name: 'Ahmedabad', stateId: 'GJ', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'GJ-DIST-GANDHINAGAR', name: 'Gandhinagar', stateId: 'GJ', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Rajasthan (RJ)
  { id: 'RJ-DIST-JAIPUR', name: 'Jaipur', stateId: 'RJ', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'RJ-DIST-JODHPUR', name: 'Jodhpur', stateId: 'RJ', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Madhya Pradesh (MP)
  { id: 'MP-DIST-BHOPAL', name: 'Bhopal', stateId: 'MP', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'MP-DIST-INDORE', name: 'Indore', stateId: 'MP', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Telangana (TG)
  { id: 'TG-DIST-HYDERABAD', name: 'Hyderabad', stateId: 'TG', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'TG-DIST-RANGA-REDDY', name: 'Ranga Reddy', stateId: 'TG', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Odisha (OD)
  { id: 'OD-DIST-KHORDHA', name: 'Khordha', stateId: 'OD', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'OD-DIST-CUTTACK', name: 'Cuttack', stateId: 'OD', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Punjab (PB)
  { id: 'PB-DIST-AMRITSAR', name: 'Amritsar', stateId: 'PB', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'PB-DIST-LUDHIANA', name: 'Ludhiana', stateId: 'PB', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Haryana (HR)
  { id: 'HR-DIST-GURUGRAM', name: 'Gurugram', stateId: 'HR', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'HR-DIST-ROHTAK', name: 'Rohtak', stateId: 'HR', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Assam (AS)
  { id: 'AS-DIST-KAMRUP-METRO', name: 'Kamrup Metropolitan', stateId: 'AS', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'AS-DIST-DIBRUGARH', name: 'Dibrugarh', stateId: 'AS', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Jharkhand (JH)
  { id: 'JH-DIST-RANCHI', name: 'Ranchi', stateId: 'JH', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'JH-DIST-DHANBAD', name: 'Dhanbad', stateId: 'JH', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Chhattisgarh (CG)
  { id: 'CG-DIST-RAIPUR', name: 'Raipur', stateId: 'CG', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'CG-DIST-BILASPUR', name: 'Bilaspur', stateId: 'CG', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Uttarakhand (UK)
  { id: 'UK-DIST-DEHRADUN', name: 'Dehradun', stateId: 'UK', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'UK-DIST-HARIDWAR', name: 'Haridwar', stateId: 'UK', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Himachal Pradesh (HP)
  { id: 'HP-DIST-SHIMLA', name: 'Shimla', stateId: 'HP', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'HP-DIST-KANGRA', name: 'Kangra', stateId: 'HP', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Goa (GA)
  { id: 'GA-DIST-NORTH-GOA', name: 'North Goa', stateId: 'GA', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'GA-DIST-SOUTH-GOA', name: 'South Goa', stateId: 'GA', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Arunachal Pradesh (AR)
  { id: 'AR-DIST-PAPUM-PARE', name: 'Papum Pare', stateId: 'AR', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'AR-DIST-TAWANG', name: 'Tawang', stateId: 'AR', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Manipur (MN)
  { id: 'MN-DIST-IMPHAL-WEST', name: 'Imphal West', stateId: 'MN', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'MN-DIST-IMPHAL-EAST', name: 'Imphal East', stateId: 'MN', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Meghalaya (ML)
  { id: 'ML-DIST-EAST-KHASI-HILLS', name: 'East Khasi Hills', stateId: 'ML', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'ML-DIST-WEST-GARO-HILLS', name: 'West Garo Hills', stateId: 'ML', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Mizoram (MZ)
  { id: 'MZ-DIST-AIZAWL', name: 'Aizawl', stateId: 'MZ', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'MZ-DIST-LUNGLEI', name: 'Lunglei', stateId: 'MZ', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Nagaland (NL)
  { id: 'NL-DIST-KOHIMA', name: 'Kohima', stateId: 'NL', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'NL-DIST-DIMAPUR', name: 'Dimapur', stateId: 'NL', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Sikkim (SK)
  { id: 'SK-DIST-GANGTOK', name: 'Gangtok', stateId: 'SK', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'SK-DIST-NAMCHI', name: 'Namchi', stateId: 'SK', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Tripura (TR)
  { id: 'TR-DIST-WEST-TRIPURA', name: 'West Tripura', stateId: 'TR', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'TR-DIST-GOMATI', name: 'Gomati', stateId: 'TR', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Andaman and Nicobar Islands (AN)
  { id: 'AN-DIST-SOUTH-ANDAMAN', name: 'South Andaman', stateId: 'AN', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'AN-DIST-NICOBARS', name: 'Nicobars', stateId: 'AN', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Chandigarh (CH)
  { id: 'CH-DIST-CHANDIGARH-CENTRAL', name: 'Chandigarh Central', stateId: 'CH', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'CH-DIST-CHANDIGARH-EAST', name: 'Chandigarh East', stateId: 'CH', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Dadra and Nagar Haveli and Daman and Diu (DN)
  { id: 'DN-DIST-DAMAN', name: 'Daman', stateId: 'DN', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'DN-DIST-SILVASSA', name: 'Dadra and Nagar Haveli', stateId: 'DN', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Jammu and Kashmir (JK)
  { id: 'JK-DIST-SRINAGAR', name: 'Srinagar', stateId: 'JK', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'JK-DIST-JAMMU', name: 'Jammu', stateId: 'JK', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Ladakh (LA)
  { id: 'LA-DIST-LEH', name: 'Leh', stateId: 'LA', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'LA-DIST-KARGIL', name: 'Kargil', stateId: 'LA', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Lakshadweep (LD)
  { id: 'LD-DIST-KAVARATTI', name: 'Kavaratti Sector', stateId: 'LD', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'LD-DIST-MINICOY', name: 'Minicoy Sector', stateId: 'LD', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },

  // Puducherry (PY)
  { id: 'PY-DIST-PUDUCHERRY', name: 'Puducherry', stateId: 'PY', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
  { id: 'PY-DIST-KARAIKAL', name: 'Karaikal', stateId: 'PY', metadataSource: METADATA_SOURCES.DEMO_SAMPLE },
];
