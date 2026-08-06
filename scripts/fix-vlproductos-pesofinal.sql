-- fix-vlproductos-pesofinal.sql
--
-- Corrige el costo cero en vlProductos. Ejecutar UNA VEZ POR BASE de proyecto
-- (FG_Frijoles, FG_Navio_7_Norte, FG_Pozole, ...). Para aplicarlo a todas de
-- golpe usa: node scripts/fix-vlproductos-pesofinal.js
--
-- Causa: la rama de insumos multiplica por A.PesoFinal sin la guardia CASE que
-- sí tienen CantidadCompra y ConversionSimple. Con PesoFinal NULL el producto
-- da NULL y la app lo muestra como $0.000. Lo mismo con G.PesoFinal dentro del
-- SUM de subrecetas: ese ingrediente aporta cero al costo del padre.
--
-- Cambios respecto de la definición anterior (marcados con << FIX >>):
--   1. guardia en A.PesoFinal          (rama IdTipoProducto = 0 de Costo)
--   2. guardia en G.PesoFinal          (rama de subrecetas, en Costo)
--   3. guardia en G.PesoFinal          (rama de subrecetas, en CostoInventario)
--   4. IS NULL faltante en G.ConversionSimple (CostoInventario)

CREATE OR REPLACE
    ALGORITHM = UNDEFINED
    DEFINER = `kyk`@`%`
    SQL SECURITY DEFINER
VIEW `vlProductos` AS
    SELECT
        `A`.`IdProducto` AS `IdProducto`,
        `A`.`Producto` AS `Producto`,
        `A`.`Codigo` AS `Codigo`,
        `A`.`Precio` AS `Precio`,
        `A`.`Iva` AS `IVA`,
        `A`.`Status` AS `Status`,
        `A`.`IdCategoria` AS `IdCategoria`,
        `B`.`Categoria` AS `Categoria`,
        `A`.`ConversionSimple` AS `ConversionSimple`,
        `A`.`PesoInicial` AS `PesoInicial`,
        `A`.`PesoFinal` AS `PesoFinal`,
        `A`.`CantidadCompra` AS `CantidadCompra`,
        `A`.`RutaFoto` AS `RutaFoto`,
        `B`.`IdModuloRecetario` AS `IdModuloRecetario`,
        `A`.`Rendimiento` AS `Rendimiento`,
        `A`.`IdTipoProducto` AS `IdTipoProducto`,
        (CASE
            WHEN
                (`A`.`IdTipoProducto` = 0)
            THEN
                (((`A`.`Precio` / (CASE
                    WHEN
                        ((`A`.`CantidadCompra` = 0)
                            OR (`A`.`CantidadCompra` IS NULL))
                    THEN
                        1
                    ELSE `A`.`CantidadCompra`
                END)) / (CASE
                    WHEN
                        ((`A`.`ConversionSimple` = 0)
                            OR (`A`.`ConversionSimple` IS NULL))
                    THEN
                        1
                    ELSE `A`.`ConversionSimple`
                END)) * (CASE                                      -- << FIX 1 >>
                    WHEN
                        ((`A`.`PesoFinal` = 0)
                            OR (`A`.`PesoFinal` IS NULL))
                    THEN
                        1
                    ELSE `A`.`PesoFinal`
                END))
            ELSE SUM(((`F`.`Cantidad` * (((`G`.`Precio` / (CASE
                WHEN
                    ((`G`.`CantidadCompra` = 0)
                        OR (`G`.`CantidadCompra` IS NULL))
                THEN
                    1
                ELSE `G`.`CantidadCompra`
            END)) / (CASE
                WHEN
                    ((`G`.`ConversionSimple` = 0)
                        OR (`G`.`ConversionSimple` IS NULL))
                THEN
                    1
                ELSE `G`.`ConversionSimple`
            END)) * (CASE                                          -- << FIX 2 >>
                WHEN
                    ((`G`.`PesoFinal` = 0)
                        OR (`G`.`PesoFinal` IS NULL))
                THEN
                    1
                ELSE `G`.`PesoFinal`
            END))) / (CASE
                WHEN
                    ((`A`.`PesoFinal` = 0)
                        OR (`A`.`PesoFinal` IS NULL))
                THEN
                    1
                ELSE `A`.`PesoFinal`
            END)))
        END) AS `Costo`,
        (CASE
            WHEN
                (`A`.`IdTipoProducto` = 0)
            THEN
                (`A`.`Precio` / (CASE
                    WHEN
                        ((`A`.`CantidadCompra` = 0)
                            OR (`A`.`CantidadCompra` IS NULL))
                    THEN
                        1
                    ELSE `A`.`CantidadCompra`
                END))
            ELSE SUM(((`F`.`Cantidad` * (((`G`.`Precio` / (CASE
                WHEN
                    ((`G`.`CantidadCompra` = 0)
                        OR (`G`.`CantidadCompra` IS NULL))
                THEN
                    1
                ELSE `G`.`CantidadCompra`
            END)) / (CASE
                WHEN
                    ((`G`.`ConversionSimple` = 0)
                        OR (`G`.`ConversionSimple` IS NULL))   -- << FIX 4 >>
                THEN
                    1
                ELSE `G`.`ConversionSimple`
            END)) * (CASE                                          -- << FIX 3 >>
                WHEN
                    ((`G`.`PesoFinal` = 0)
                        OR (`G`.`PesoFinal` IS NULL))
                THEN
                    1
                ELSE `G`.`PesoFinal`
            END))) / (CASE
                WHEN
                    ((`A`.`PesoFinal` = 0)
                        OR (`A`.`PesoFinal` IS NULL))
                THEN
                    1
                ELSE `A`.`PesoFinal`
            END)))
        END) AS `CostoInventario`,
        `A`.`NombreArchivo` AS `NombreArchivo`,
        `A`.`ArchivoImagen` AS `ArchivoImagen`,
        `A`.`UnidadMedidaCompra` AS `UnidadMedidaCompra`,
        `A`.`UnidadMedidaInventario` AS `UnidadMedidaInventario`,
        `A`.`UnidadMedidaRecetario` AS `UnidadMedidaRecetario`,
        `B`.`ImagenCategoria` AS `ImagenCategoria`,
        `A`.`FechaAct` AS `FechaAct`
    FROM
        (((`tblProductos` `A`
        LEFT JOIN `BDFoodieProjects`.`tblCategorias` `B` ON ((`A`.`IdCategoria` = `B`.`IdCategoria`)))
        LEFT JOIN `tblProductosKits` `F` ON ((`A`.`IdProducto` = `F`.`IdProductoPadre`)))
        LEFT JOIN `tblProductos` `G` ON ((`F`.`IdProductoHijo` = `G`.`IdProducto`)))
    WHERE
        (`A`.`IdTipoProducto` IN (0 , 2))
    GROUP BY `A`.`IdProducto` , `A`.`Producto` , `A`.`Codigo` , `A`.`Precio` , `A`.`Iva` , `A`.`Status` , `A`.`IdCategoria` , `B`.`Categoria` , `A`.`CantidadCompra` , `A`.`ConversionSimple` , `A`.`PesoInicial` , `A`.`PesoFinal` , `A`.`RutaFoto` , `B`.`IdModuloRecetario` , `A`.`Rendimiento` , `A`.`IdTipoProducto` , `A`.`NombreArchivo` , `A`.`ArchivoImagen` , `A`.`UnidadMedidaCompra` , `A`.`UnidadMedidaInventario` , `A`.`UnidadMedidaRecetario` , `B`.`ImagenCategoria`;


-- Verificación: debe devolver 0 filas con Costo NULL.
SELECT COUNT(*) AS CostoNull FROM vlProductos WHERE Costo IS NULL;

-- En FG_Navio_7_Norte, el producto reportado debe costear 40.
-- SELECT IdProducto, Producto, Costo, CostoInventario FROM vlProductos WHERE IdProducto = 123;


-- OPCIONAL (cosmético): con la vista ya parchada, NULL y 1 dan el mismo costo.
-- Sirve para que el modal de costeo no muestre el campo vacío y no truene su
-- validación "El Peso Final debe ser mayor a 0".
-- UPDATE tblProductos SET PesoFinal = 1 WHERE PesoFinal IS NULL;
-- UPDATE tblProductos SET ConversionSimple = 1 WHERE ConversionSimple IS NULL;
