export interface Address {
  city: string;
  house: string;
}

export interface Purchase {
  price: number;
  type: string;
  subType: string;
  vatRate: string;
  serviceCostsPerMonth: number;
}

export interface Rental {
  price: number;
  type: string;
  subType: string;
  vatRate: string;
  tenantCosts: number;
  securityDeposit: number;
  serviceCharges: number;
  minMonths: number;
  nameTag?: number | null;
}

export interface Prices {
  category: string;
  isPoundHouse: boolean;
  purchase: Purchase;
  rental: Rental;
}

export interface Status {
  name: string;
  code: number;
  soldOn?: Date | string;
}

export interface Type {
  category: string;
  type: string;
  subType: string;
  buildType: string;
}

export interface Attributes {
  type: Type;
}

export interface House {
  address: Address;
  prices: Prices;
  status: Status;
  attributes: Attributes;
  surface: number;
  rooms: number;
  interestedParties: number;
  sourceId: string;
  acceptance: Date | string;
  coordinate: number[];
  image: string;
  id: string;
  url: string;
}

export interface Settings {
  default: string;
  title: string;
  type: string;
  optionsKey: string;
}

export interface City {
  settings: Settings;
}

export interface Settings2 {
  default: number;
  title: string;
  type: string;
}

export interface Radius {
  settings: Settings2;
}

export interface Settings3 {
  default: string;
  title: string;
  type: string;
}

export interface Address2 {
  settings: Settings3;
}

export interface Default {
  min: number;
  max: number;
}

export interface Settings4 {
  default: Default;
  title: string;
  type: string;
  label: string;
}

export interface Value {
  boundary: number;
  count: number;
}

export interface PriceRental {
  settings: Settings4;
  values: Value[];
}

export interface Settings5 {
  default: string;
  title: string;
  type: string;
  label: string;
}

export interface Value2 {
  boundary: Date;
  count: number;
}

export interface Availablefrom {
  settings: Settings5;
  values: Value2[];
}

export interface Settings6 {
  default: string;
  title: string;
  type: string;
  label: string;
}

export interface Value3 {
  boundary: number;
  count: number;
}

export interface Surface {
  settings: Settings6;
  values: Value3[];
}

export interface Settings7 {
  default: number;
  title: string;
  type: string;
  label: string;
}

export interface Value4 {
  boundary: number;
  count: number;
}

export interface Rooms {
  settings: Settings7;
  values: Value4[];
}

export interface Settings8 {
  default: string;
  title: string;
  hideOnSelect: boolean;
  translate: boolean;
  label: string;
  type: string;
}

export interface Value5 {
  boundary: string;
  count: number;
  title: string;
}

export interface TypeCategory {
  settings: Settings8;
  values: Value5[];
}

export interface SearchOptions {
  city: City;
  radius: Radius;
  address: Address2;
  priceRental: PriceRental;
  availablefrom: Availablefrom;
  surface: Surface;
  rooms: Rooms;
  typeCategory: TypeCategory;
}

export interface RootObject {
  houses: House[];
  pageCount: number;
  searchOptions: SearchOptions;
}

export interface HomeResponseObject {
  houses: House[];
  pageCount: number;
  searchOptions: SearchOptions;
}
