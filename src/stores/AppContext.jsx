import { createContext, useCallback, useContext, useEffect, useReducer, useState } from "react";
import {
  dbDeleteAsset,
  dbDeleteCategory,
  dbDeleteCountry,
  dbDeleteLocation,
  dbFetchAssets,
  dbFetchCategories,
  dbFetchCountries,
  dbFetchLocations,
  dbFetchTransfers,
  dbInsertAsset,
  dbInsertAuditLog,
  dbInsertCategory,
  dbInsertCountry,
  dbInsertLocation,
  dbInsertTransfer,
  dbUpdateAsset,
  dbUpdateCategory,
  dbUpdateCountry,
  dbUpdateLocation,
} from "../lib/db";
import { deleteFiles, diffRemovedAssetStoragePaths, uploadAssetFiles, collectAssetStoragePaths } from "../lib/storage";
import { isOnline } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { DEFAULT_COUNTRIES, buildFlagMap } from "../lib/countries";
import { getRentalCountdownState, getRentalRangeKind, isRentalLocationName } from "../lib/locationUtils";

const AppContext = createContext(null);

export const DEFAULT_CATEGORIES = [
  "Maquinaria Pesada",
  "Maquinaria Ligera",
  "Vehículos (Flota)",
  "Equipos Industriales",
  "Equipos de TI",
];

export const STATUSES = ["Operativo", "Mantenimiento", "Baja"];

function genId(prefix = "ACT") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 4)
    .toUpperCase()}`;
}

const init = { assets: [], transfers: [], locations: [], categories: [], countriesData: [] };

function buildDefaultCategoryRows() {
  return DEFAULT_CATEGORIES.map((name, index) => ({
    id: `cat-0${index + 1}`,
    name,
    color: "#1d6fef",
  }));
}

function mergeCategoryCatalog(categories = []) {
  const merged = [...categories];
  const existingNames = new Set(merged.map((category) => category.name?.trim().toLowerCase()).filter(Boolean));

  buildDefaultCategoryRows().forEach((category) => {
    const normalizedName = category.name.trim().toLowerCase();
    if (!existingNames.has(normalizedName)) {
      merged.push(category);
      existingNames.add(normalizedName);
    }
  });

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

function summarizeAsset(asset) {
  if (!asset) return null;
  return {
    assetId: asset.assetId ?? "",
    plate: asset.plate ?? "",
    brand: asset.brand ?? "",
    model: asset.model ?? "",
    category: asset.category ?? "",
    status: asset.status ?? "",
    location: asset.location ?? "",
    rentalStartDate: asset.rentalStartDate ?? "",
    rentalEndDate: asset.rentalEndDate ?? "",
    rentalStartTime: asset.rentalStartTime ?? "",
    rentalEndTime: asset.rentalEndTime ?? "",
  };
}

function summarizeLocation(location) {
  if (!location) return null;
  return {
    name: location.name ?? "",
    country: location.country ?? "",
    address: location.address ?? "",
    rentalStartDate: location.rentalStartDate ?? "",
    rentalEndDate: location.rentalEndDate ?? "",
  };
}

function summarizeCategory(category) {
  if (!category) return null;
  return {
    name: category.name ?? "",
    color: category.color ?? "",
  };
}

function summarizeCountry(country) {
  if (!country) return null;
  return {
    name: country.name ?? "",
    flag: country.flag ?? "",
  };
}

function diffKeys(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]));
}

function findLocationRecord(locations = [], { id, name, country } = {}) {
  return locations.find((location) => location.id === id)
    || locations.find((location) => location.name === name && location.country === country)
    || null;
}

function findLatestRentalTransfer(transfers = [], asset) {
  if (!asset) return null;
  return [...transfers]
    .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime())
    .find((transfer) =>
      transfer.assetId === asset.id
      && Boolean(getRentalRangeKind(transfer))
      && transfer.toLocation === asset.location
      && transfer.toCountry === asset.country
    ) || null;
}

function reducer(state, action) {
  switch (action.type) {
    case "LOAD":
      return { ...state, ...action.payload };
    case "SET_ASSETS":
      return { ...state, assets: action.payload };
    case "SET_LOCATIONS":
      return { ...state, locations: action.payload };
    case "SET_TRANSFERS":
      return { ...state, transfers: action.payload };
    case "SET_CATEGORIES":
      return { ...state, categories: action.payload };
    case "SET_COUNTRIES":
      return { ...state, countriesData: action.payload };
    case "ADD_ASSET":
      return { ...state, assets: [action.payload, ...state.assets] };
    case "UPDATE_ASSET":
      return {
        ...state,
        assets: state.assets.map((asset) =>
          asset.id === action.payload.id ? { ...asset, ...action.payload } : asset
        ),
      };
    case "DELETE_ASSET":
      return { ...state, assets: state.assets.filter((asset) => asset.id !== action.id) };
    case "ADD_LOCATION":
      return { ...state, locations: [action.payload, ...state.locations] };
    case "UPDATE_LOCATION":
      return {
        ...state,
        locations: state.locations.map((location) =>
          location.id === action.payload.id ? { ...location, ...action.payload } : location
        ),
      };
    case "DELETE_LOCATION":
      return { ...state, locations: state.locations.filter((location) => location.id !== action.id) };
    case "ADD_TRANSFER":
      return { ...state, transfers: [action.payload, ...state.transfers] };
    case "ADD_CATEGORY":
      return {
        ...state,
        categories: [...state.categories, action.payload].sort((a, b) => a.name.localeCompare(b.name)),
      };
    case "UPDATE_CATEGORY":
      return {
        ...state,
        categories: state.categories.map((category) =>
          category.id === action.payload.id ? action.payload : category
        ),
      };
    case "DELETE_CATEGORY":
      return { ...state, categories: state.categories.filter((category) => category.id !== action.id) };
    case "ADD_COUNTRY":
      return {
        ...state,
        countriesData: [...state.countriesData, action.payload].sort((a, b) => a.name.localeCompare(b.name)),
      };
    case "UPDATE_COUNTRY":
      return {
        ...state,
        countriesData: state.countriesData.map((country) =>
          country.id === action.payload.id ? action.payload : country
        ),
        locations: state.locations.map((location) =>
          location.country === action.previousName
            ? { ...location, country: action.payload.name }
            : location
        ),
        assets: state.assets.map((asset) =>
          asset.country === action.previousName
            ? { ...asset, country: action.payload.name }
            : asset
        ),
      };
    case "DELETE_COUNTRY":
      return { ...state, countriesData: state.countriesData.filter((country) => country.id !== action.id) };
    case "TRANSFER_ASSET_LOCAL": {
      const {
        assetId,
        toLocationId,
        toLocationName,
        toCountry,
        fromAddress = null,
        toAddress = null,
        rentalStartDate = null,
        rentalEndDate = null,
        rentalStartTime = null,
        rentalEndTime = null,
        transferId,
        ts,
      } = action.payload;
      const asset = state.assets.find((item) => item.id === assetId);
      const transfer = {
        id: transferId,
        assetId,
        fromLocation: asset?.location,
        fromCountry: asset?.country,
        fromAddress,
        toLocation: toLocationName,
        toCountry,
        toAddress,
        rentalStartDate,
        rentalEndDate,
        rentalStartTime,
        rentalEndTime,
        ts,
      };

      return {
        ...state,
        assets: state.assets.map((item) =>
          item.id === assetId
            ? {
                ...item,
                locationId: toLocationId,
                location: toLocationName,
                country: toCountry,
                rentalStartDate: rentalStartDate || null,
                rentalEndDate: rentalEndDate || null,
                rentalStartTime: rentalStartTime || null,
                rentalEndTime: rentalEndTime || null,
              }
            : item
        ),
        transfers: [transfer, ...state.transfers],
      };
    }
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const { session, profile } = useAuth();
  const [state, dispatch] = useReducer(reducer, init);
  const [dbReady, setDbReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(null);

  const logActivity = useCallback(
    async ({ action, entityType, entityId = null, entityLabel = null, details = {} }) => {
      if (!isOnline()) return;
      await dbInsertAuditLog({
        id: genId("LOG"),
        userId: session?.user?.id ?? null,
        userEmail: profile?.email ?? session?.user?.email ?? null,
        userName: profile?.full_name ?? session?.user?.user_metadata?.full_name ?? null,
        action,
        entityType,
        entityId,
        entityLabel,
        details,
        createdAt: new Date().toISOString(),
      });
    },
    [profile, session]
  );

  useEffect(() => {
    async function load() {
      if (!isOnline()) {
        setDbReady(false);
        setLoading(false);
        return;
      }

      try {
        const [assets, locations, transfers, categories, countries] = await Promise.all([
          dbFetchAssets(),
          dbFetchLocations(),
          dbFetchTransfers(),
          dbFetchCategories(),
          dbFetchCountries(),
        ]);

        dispatch({
          type: "LOAD",
          payload: {
            assets,
            locations,
            transfers,
            categories: mergeCategoryCatalog(categories),
            countriesData: countries.length ? countries : DEFAULT_COUNTRIES,
          },
        });
        setDbReady(true);
      } catch (error) {
        console.error("[AppContext] load error:", error);
        setSyncError("No se pudo conectar con Supabase. Trabajando sin conexion.");
        setDbReady(false);
        dispatch({
          type: "LOAD",
          payload: {
            categories: buildDefaultCategoryRows(),
            countriesData: DEFAULT_COUNTRIES,
          },
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const addAsset = useCallback(async (form) => {
    const newId = genId("ACT");
    const now = new Date().toISOString();
    const optimistic = { ...form, id: newId, createdAt: now };

    dispatch({ type: "ADD_ASSET", payload: optimistic });
    if (!isOnline()) return optimistic;

    try {
      const fileData = await uploadAssetFiles(newId, form);
      const saved = await dbInsertAsset({ ...form, ...fileData, id: newId, createdAt: now });
      dispatch({ type: "UPDATE_ASSET", payload: saved });
      setSyncError(null);
      await logActivity({
        action: "create",
        entityType: "asset",
        entityId: saved.id,
        entityLabel: `${saved.brand} ${saved.model}`.trim(),
        details: summarizeAsset(saved),
      });
      return saved;
    } catch (error) {
      console.error("[addAsset]", error);
      dispatch({ type: "DELETE_ASSET", id: newId });
      setSyncError("Error al guardar el activo: " + error.message);
      throw error;
    }
  }, [logActivity]);

  const updateAsset = useCallback(
    async (form) => {
      const previous = state.assets.find((asset) => asset.id === form.id);
      dispatch({ type: "UPDATE_ASSET", payload: form });
      if (!isOnline()) return form;

      try {
        const fileData = await uploadAssetFiles(form.id, form);
        const saved = await dbUpdateAsset({ ...form, ...fileData });
        const removedPaths = diffRemovedAssetStoragePaths(previous, saved);
        if (removedPaths.length) await deleteFiles(removedPaths);
        dispatch({ type: "UPDATE_ASSET", payload: saved });
        setSyncError(null);
        await logActivity({
          action: "update",
          entityType: "asset",
          entityId: saved.id,
          entityLabel: `${saved.brand} ${saved.model}`.trim(),
          details: {
            changedFields: diffKeys(summarizeAsset(previous), summarizeAsset(saved)),
            before: summarizeAsset(previous),
            after: summarizeAsset(saved),
          },
        });
        return saved;
      } catch (error) {
        console.error("[updateAsset]", error);
        if (previous) dispatch({ type: "UPDATE_ASSET", payload: previous });
        setSyncError("Error al actualizar el activo: " + error.message);
        throw error;
      }
    },
    [logActivity, state.assets]
  );

  const deleteAsset = useCallback(async (id) => {
    const previous = state.assets.find((asset) => asset.id === id);
    dispatch({ type: "DELETE_ASSET", id });
    if (!isOnline()) return;

    try {
      const pathsToDelete = collectAssetStoragePaths(previous);
      await dbDeleteAsset(id);
      if (pathsToDelete.length) await deleteFiles(pathsToDelete);
      setSyncError(null);
      await logActivity({
        action: "delete",
        entityType: "asset",
        entityId: previous?.id ?? id,
        entityLabel: previous ? `${previous.brand} ${previous.model}`.trim() : id,
        details: summarizeAsset(previous),
      });
    } catch (error) {
      console.error("[deleteAsset]", error);
      if (previous) dispatch({ type: "ADD_ASSET", payload: previous });
      setSyncError("Error al eliminar el activo: " + error.message);
      throw error;
    }
  }, [logActivity, state.assets]);

  const addLocation = useCallback(async (form) => {
    const payload = { ...form, id: genId("LOC"), createdAt: new Date().toISOString() };
    dispatch({ type: "ADD_LOCATION", payload });
    if (!isOnline()) return payload;

    try {
      const saved = await dbInsertLocation(payload);
      dispatch({ type: "UPDATE_LOCATION", payload: saved });
      setSyncError(null);
      await logActivity({
        action: "create",
        entityType: "location",
        entityId: saved.id,
        entityLabel: saved.name,
        details: summarizeLocation(saved),
      });
      return saved;
    } catch (error) {
      console.error("[addLocation]", error);
      dispatch({ type: "DELETE_LOCATION", id: payload.id });
      setSyncError("Error al guardar la ubicacion: " + error.message);
      throw error;
    }
  }, [logActivity]);

  const updateLocation = useCallback(
    async (form) => {
      const previous = state.locations.find((location) => location.id === form.id);
      dispatch({ type: "UPDATE_LOCATION", payload: form });
      if (!isOnline()) return form;

      try {
        const saved = await dbUpdateLocation(form);
        dispatch({ type: "UPDATE_LOCATION", payload: saved });
        setSyncError(null);
        await logActivity({
          action: "update",
          entityType: "location",
          entityId: saved.id,
          entityLabel: saved.name,
          details: {
            changedFields: diffKeys(summarizeLocation(previous), summarizeLocation(saved)),
            before: summarizeLocation(previous),
            after: summarizeLocation(saved),
          },
        });
        return saved;
      } catch (error) {
        console.error("[updateLocation]", error);
        if (previous) dispatch({ type: "UPDATE_LOCATION", payload: previous });
        setSyncError("Error al actualizar la ubicacion: " + error.message);
        throw error;
      }
    },
    [logActivity, state.locations]
  );

  const deleteLocation = useCallback(async (id) => {
    const previous = state.locations.find((location) => location.id === id);
    dispatch({ type: "DELETE_LOCATION", id });
    if (!isOnline()) return;

    try {
      await dbDeleteLocation(id);
      setSyncError(null);
      await logActivity({
        action: "delete",
        entityType: "location",
        entityId: previous?.id ?? id,
        entityLabel: previous?.name ?? id,
        details: summarizeLocation(previous),
      });
    } catch (error) {
      console.error("[deleteLocation]", error);
      if (previous) dispatch({ type: "ADD_LOCATION", payload: previous });
      setSyncError("Error al eliminar la ubicacion: " + error.message);
      throw error;
    }
  }, [logActivity, state.locations]);

  const transferAsset = useCallback(
    async (payload) => {
      const asset = state.assets.find((item) => item.id === payload.assetId);
      const destination = state.locations.find((location) => location.id === payload.toLocationId);
      const currentLocation = findLocationRecord(state.locations, {
        id: asset?.locationId,
        name: asset?.location,
        country: asset?.country,
      });
      const rentalDestination = isRentalLocationName(destination?.name || payload.toLocationName);
      const transferId = genId("TRF");
      const ts = new Date().toISOString();
      const transferPayload = {
        ...payload,
        transferId,
        ts,
        toLocationName: destination?.name ?? payload.toLocationName ?? "",
        toCountry: destination?.country ?? payload.toCountry ?? "",
        fromAddress: currentLocation?.address ?? null,
        toAddress: destination?.address ?? payload.toAddress ?? null,
        rentalStartDate: rentalDestination ? (payload.rentalStartDate || null) : null,
        rentalEndDate: rentalDestination ? (payload.rentalEndDate || null) : null,
        rentalStartTime: rentalDestination ? (payload.rentalStartTime || null) : null,
        rentalEndTime: rentalDestination ? (payload.rentalEndTime || null) : null,
      };

      dispatch({ type: "TRANSFER_ASSET_LOCAL", payload: transferPayload });
      if (!isOnline()) return;

      try {
        const transfer = {
          id: transferId,
          assetId: transferPayload.assetId,
          fromLocation: asset?.location ?? null,
          fromCountry: asset?.country ?? null,
          fromAddress: transferPayload.fromAddress,
          toLocation: transferPayload.toLocationName,
          toCountry: transferPayload.toCountry,
          toAddress: transferPayload.toAddress,
          rentalStartDate: transferPayload.rentalStartDate,
          rentalEndDate: transferPayload.rentalEndDate,
          rentalStartTime: transferPayload.rentalStartTime,
          rentalEndTime: transferPayload.rentalEndTime,
          ts,
        };

        const savedTransfer = await dbInsertTransfer(transfer);
        const savedAsset = await dbUpdateAsset({
          ...asset,
          locationId: transferPayload.toLocationId,
          location: transferPayload.toLocationName,
          country: transferPayload.toCountry,
          rentalStartDate: transferPayload.rentalStartDate,
          rentalEndDate: transferPayload.rentalEndDate,
          rentalStartTime: transferPayload.rentalStartTime,
          rentalEndTime: transferPayload.rentalEndTime,
        });
        dispatch({ type: "UPDATE_ASSET", payload: savedAsset });
        dispatch({
          type: "SET_TRANSFERS",
          payload: state.transfers
            .filter((item) => item.id !== transferId)
            .concat(savedTransfer)
            .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime()),
        });
        setSyncError(null);
        await logActivity({
          action: "transfer",
          entityType: "asset",
          entityId: asset?.id ?? transferPayload.assetId,
          entityLabel: asset ? `${asset.brand} ${asset.model}`.trim() : transferPayload.assetId,
          details: {
            assetId: asset?.assetId ?? "",
            brand: asset?.brand ?? "",
            model: asset?.model ?? "",
            fromLocation: asset?.location ?? null,
            fromCountry: asset?.country ?? null,
            fromAddress: transferPayload.fromAddress,
            toLocation: transferPayload.toLocationName,
            toCountry: transferPayload.toCountry,
            toAddress: transferPayload.toAddress,
            rentalStartDate: transferPayload.rentalStartDate,
            rentalEndDate: transferPayload.rentalEndDate,
            rentalStartTime: transferPayload.rentalStartTime,
            rentalEndTime: transferPayload.rentalEndTime,
          },
        });
      } catch (error) {
        console.error("[transferAsset]", error);
        setSyncError("Error al trasladar el activo: " + error.message);
        throw error;
      }
    },
    [logActivity, state.assets, state.locations, state.transfers]
  );

  const returnRentalAsset = useCallback(
    async (assetId) => {
      const asset = state.assets.find((item) => item.id === assetId);
      if (!asset) throw new Error("No se encontro el activo a retornar.");

      const rentalState = getRentalCountdownState(asset, new Date(), "es");
      if (!rentalState?.canReturn) {
        throw new Error("El activo aun no esta disponible para retorno.");
      }

      const sourceTransfer = findLatestRentalTransfer(state.transfers, asset);
      if (!sourceTransfer?.fromLocation) {
        throw new Error("No se encontro la ubicacion original del alquiler.");
      }

      const originLocation = findLocationRecord(state.locations, {
        name: sourceTransfer.fromLocation,
        country: sourceTransfer.fromCountry,
      });
      const transferId = genId("TRF");
      const ts = new Date().toISOString();
      const returnPayload = {
        assetId: asset.id,
        transferId,
        ts,
        toLocationId: originLocation?.id ?? null,
        toLocationName: originLocation?.name ?? sourceTransfer.fromLocation,
        toCountry: originLocation?.country ?? sourceTransfer.fromCountry ?? asset.country,
        toAddress: originLocation?.address ?? sourceTransfer.fromAddress ?? null,
        fromAddress: sourceTransfer.toAddress ?? null,
        rentalStartDate: null,
        rentalEndDate: null,
        rentalStartTime: null,
        rentalEndTime: null,
      };

      dispatch({ type: "TRANSFER_ASSET_LOCAL", payload: returnPayload });
      if (!isOnline()) return returnPayload;

      try {
        const savedTransfer = await dbInsertTransfer({
          id: transferId,
          assetId: asset.id,
          fromLocation: asset.location ?? null,
          fromCountry: asset.country ?? null,
          fromAddress: sourceTransfer.toAddress ?? null,
          toLocation: returnPayload.toLocationName,
          toCountry: returnPayload.toCountry,
          toAddress: returnPayload.toAddress,
          rentalStartDate: null,
          rentalEndDate: null,
          rentalStartTime: null,
          rentalEndTime: null,
          ts,
        });
        const savedAsset = await dbUpdateAsset({
          ...asset,
          locationId: returnPayload.toLocationId,
          location: returnPayload.toLocationName,
          country: returnPayload.toCountry,
          rentalStartDate: null,
          rentalEndDate: null,
          rentalStartTime: null,
          rentalEndTime: null,
        });
        dispatch({ type: "UPDATE_ASSET", payload: savedAsset });
        dispatch({
          type: "SET_TRANSFERS",
          payload: state.transfers
            .filter((item) => item.id !== transferId)
            .concat(savedTransfer)
            .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime()),
        });
        setSyncError(null);
        await logActivity({
          action: "rental_return",
          entityType: "asset",
          entityId: asset.id,
          entityLabel: `${asset.brand} ${asset.model}`.trim(),
          details: {
            assetId: asset.assetId ?? "",
            brand: asset.brand ?? "",
            model: asset.model ?? "",
            fromLocation: asset.location ?? null,
            fromCountry: asset.country ?? null,
            fromAddress: sourceTransfer.toAddress ?? null,
            toLocation: returnPayload.toLocationName,
            toCountry: returnPayload.toCountry,
            toAddress: returnPayload.toAddress,
            title: "retorno de alquiler",
          },
        });
        return savedAsset;
      } catch (error) {
        console.error("[returnRentalAsset]", error);
        setSyncError("Error al retornar el activo: " + error.message);
        throw error;
      }
    },
    [logActivity, state.assets, state.locations, state.transfers]
  );

  const addCategory = useCallback(async (form) => {
    const payload = {
      id: genId("CAT"),
      name: form.name.trim(),
      color: form.color || "#1d6fef",
    };

    dispatch({ type: "ADD_CATEGORY", payload });
    if (!isOnline()) return payload;

    try {
      const saved = await dbInsertCategory(payload);
      if (saved?.id) dispatch({ type: "UPDATE_CATEGORY", payload: saved });
      setSyncError(null);
      await logActivity({
        action: "create",
        entityType: "category",
        entityId: saved?.id ?? payload.id,
        entityLabel: saved?.name ?? payload.name,
        details: summarizeCategory(saved ?? payload),
      });
      return saved;
    } catch (error) {
      console.error("[addCategory]", error);
      dispatch({ type: "DELETE_CATEGORY", id: payload.id });
      setSyncError("Error al guardar la categoria: " + error.message);
      throw error;
    }
  }, [logActivity]);

  const updateCategory = useCallback(
    async (form) => {
      const previous = state.categories.find((category) => category.id === form.id);
      dispatch({ type: "UPDATE_CATEGORY", payload: form });
      if (!isOnline()) return form;

      try {
        const saved = await dbUpdateCategory(form);
        dispatch({ type: "UPDATE_CATEGORY", payload: saved });
        setSyncError(null);
        await logActivity({
          action: "update",
          entityType: "category",
          entityId: saved.id,
          entityLabel: saved.name,
          details: {
            changedFields: diffKeys(summarizeCategory(previous), summarizeCategory(saved)),
            before: summarizeCategory(previous),
            after: summarizeCategory(saved),
          },
        });
        return saved;
      } catch (error) {
        console.error("[updateCategory]", error);
        if (previous) dispatch({ type: "UPDATE_CATEGORY", payload: previous });
        setSyncError("Error al actualizar la categoria: " + error.message);
        throw error;
      }
    },
    [logActivity, state.categories]
  );

  const deleteCategory = useCallback(async (id) => {
    const previous = state.categories.find((category) => category.id === id);
    dispatch({ type: "DELETE_CATEGORY", id });
    if (!isOnline()) return;

    try {
      await dbDeleteCategory(id);
      setSyncError(null);
      await logActivity({
        action: "delete",
        entityType: "category",
        entityId: previous?.id ?? id,
        entityLabel: previous?.name ?? id,
        details: summarizeCategory(previous),
      });
    } catch (error) {
      console.error("[deleteCategory]", error);
      if (previous) dispatch({ type: "ADD_CATEGORY", payload: previous });
      setSyncError("Error al eliminar la categoria: " + error.message);
      throw error;
    }
  }, [logActivity, state.categories]);

  const addCountry = useCallback(async (form) => {
    const payload = {
      id: `country-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
      name: form.name.trim(),
      flag: form.flag.trim(),
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: "ADD_COUNTRY", payload });
    if (!isOnline()) return payload;

    try {
      const saved = await dbInsertCountry(payload);
      dispatch({ type: "SET_COUNTRIES", payload: [...state.countriesData, saved].sort((a, b) => a.name.localeCompare(b.name)) });
      setSyncError(null);
      await logActivity({
        action: "create",
        entityType: "country",
        entityId: saved.id,
        entityLabel: saved.name,
        details: summarizeCountry(saved),
      });
      return saved;
    } catch (error) {
      console.error("[addCountry]", error);
      dispatch({ type: "DELETE_COUNTRY", id: payload.id });
      setSyncError("Error al guardar el pais: " + error.message);
      throw error;
    }
  }, [logActivity, state.countriesData]);

  const updateCountry = useCallback(async (form) => {
    const previous = state.countriesData.find((country) => country.id === form.id);
    dispatch({ type: "UPDATE_COUNTRY", payload: form, previousName: previous?.name ?? "" });
    if (!isOnline()) return form;

    try {
      const saved = await dbUpdateCountry(form);
      if (previous?.name && previous.name !== saved.name) {
        await Promise.all([
          ...state.locations
            .filter((location) => location.country === previous.name)
            .map((location) => dbUpdateLocation({ ...location, country: saved.name })),
          ...state.assets
            .filter((asset) => asset.country === previous.name)
            .map((asset) => dbUpdateAsset({ ...asset, country: saved.name })),
        ]);
      }
      dispatch({
        type: "SET_COUNTRIES",
        payload: state.countriesData.map((country) => country.id === saved.id ? saved : country).sort((a, b) => a.name.localeCompare(b.name)),
      });
      setSyncError(null);
      await logActivity({
        action: "update",
        entityType: "country",
        entityId: saved.id,
        entityLabel: saved.name,
        details: {
          changedFields: diffKeys(summarizeCountry(previous), summarizeCountry(saved)),
          before: summarizeCountry(previous),
          after: summarizeCountry(saved),
        },
      });
      return saved;
    } catch (error) {
      console.error("[updateCountry]", error);
      if (previous) dispatch({ type: "UPDATE_COUNTRY", payload: previous, previousName: form.name });
      setSyncError("Error al actualizar el pais: " + error.message);
      throw error;
    }
  }, [logActivity, state.assets, state.countriesData, state.locations]);

  const deleteCountry = useCallback(async (id) => {
    const previous = state.countriesData.find((country) => country.id === id);
    dispatch({ type: "DELETE_COUNTRY", id });
    if (!isOnline()) return;

    try {
      await dbDeleteCountry(id);
      setSyncError(null);
      await logActivity({
        action: "delete",
        entityType: "country",
        entityId: previous?.id ?? id,
        entityLabel: previous?.name ?? id,
        details: summarizeCountry(previous),
      });
    } catch (error) {
      console.error("[deleteCountry]", error);
      if (previous) dispatch({ type: "ADD_COUNTRY", payload: previous });
      setSyncError("Error al eliminar el pais: " + error.message);
      throw error;
    }
  }, [logActivity, state.countriesData]);
  const countries = [...new Set([
    ...state.locations.map((location) => location.country),
    ...state.assets.map((asset) => asset.country),
  ].filter(Boolean))].sort();
  const FLAG_MAP = buildFlagMap(state.countriesData);
  const CATEGORIES = state.categories.map((category) => category.name);

  return (
    <AppContext.Provider
      value={{
        ...state,
        countries,
        loading,
        dbReady,
        syncError,
        clearSyncError: () => setSyncError(null),
        CATEGORIES,
        STATUSES,
        countryOptions: state.countriesData,
        FLAG_MAP,
        addAsset,
        updateAsset,
        deleteAsset,
        addLocation,
        updateLocation,
        deleteLocation,
        transferAsset,
        returnRentalAsset,
        addCategory,
        updateCategory,
        deleteCategory,
        addCountry,
        updateCountry,
        deleteCountry,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
